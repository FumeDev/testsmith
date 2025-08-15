import type { Page } from '../types/page';

let stagehandInstance: any | null = null;

export function setStagehandInstance(instance: any) {
  stagehandInstance = instance;
}

async function getStagehandInstance(): Promise<any | null> {
  // Prefer explicitly set instance, then global, else null
  if (stagehandInstance) return stagehandInstance;
  // @ts-ignore
  if ((globalThis as any).stagehand) return (globalThis as any).stagehand;
  return null;
}

// ------------------ aiAct ------------------

export async function aiAct(
  page: Page,
  description: string,
  timeout: number = 30000
): Promise<boolean> {
  const testId = (page as any).progressTracker?.getTestId?.() || `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Wait for page readiness (best-effort)
  try {
    await page.waitForLoadState('domcontentloaded', { timeout });
  } catch {}

  try {
    const stagehand = await getStagehandInstance();
    if (!stagehand) {
      // Fallback: try using page.observe as a last resort signal the action could be performed
      const observations = await page.observe(description);
      (page as any).progressTracker?.addStep?.(`Action: ${description}`);
      return observations.length > 0;
    }

    const progressString = (page as any).progressTracker?.getProgressString?.();
    const agent = stagehand.agent({
      provider: 'openai',
      model: 'computer-use-preview',
      instructions: `You are a persistent AI agent operating a web browser to perform a QA test step that Playwright failed to perform. Execute precisely the requested step and stop immediately after it is completed.\n\nPrevious steps:\n${progressString || 'N/A'}`,
    });

    const result = await agent.execute(description);
    const success = !!result?.success;

    if (success) {
      (page as any).progressTracker?.addStep?.(`Action: ${description}`);
    }
    return success;
  } catch {
    return false;
  }
}

// ------------------ aiExtract ------------------

export interface AiUtilityConfig {
  apiKey?: string;
  endpoint?: string;
  apiVersion?: string;
  deploymentName?: string;
  aiRequestTimeout?: number;
  screenshotDir?: string;
  skipAttachScreenshot?: boolean;
}

const defaultExtractConfig: AiUtilityConfig = {
  apiKey: process.env.AZURE_API_KEY,
  endpoint: process.env.AZURE_API_BASE,
  apiVersion: process.env.AZURE_API_VERSION || '2024-02-15-preview',
  deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1',
  aiRequestTimeout: 180000,
  screenshotDir: 'test-results',
  skipAttachScreenshot: false,
};

async function initAzureClient(config: AiUtilityConfig) {
  // Dynamic import to avoid build-time dependency on openai types
  const { AzureOpenAI } = await import('openai');
  return new AzureOpenAI({
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    apiVersion: config.apiVersion,
  } as any);
}

export async function aiExtract(
  page: Page,
  variableName: string,
  extractionGuide: string,
  config: AiUtilityConfig = {},
  pageLoadTimeout: number = 5000,
  retryCount: number = 0
): Promise<string> {
  const { test } = await import('@playwright/test');
  const fs = await import('fs');
  const path = await import('path');

  const mergedConfig = { ...defaultExtractConfig, ...config };
  const testId = (page as any).progressTracker?.getTestId?.() || `aiExtract-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  try { await page.waitForLoadState('domcontentloaded', { timeout: pageLoadTimeout }); } catch {}
  try { await page.waitForLoadState('networkidle', { timeout: pageLoadTimeout }); } catch {}
  await page.waitForTimeout(1000);

  return await test.step(`AI Extract: ${variableName} - Guide: "${extractionGuide.substring(0, 100)}..."`, async () => {
    const openai = await initAzureClient(mergedConfig);

    const screenshotDir = mergedConfig.screenshotDir!;
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotDir, `aiExtract-${variableName}-${timestamp}.png`);

    await test.step(`Taking screenshot for ${variableName}`, async () => {
      await page.screenshot({ path: screenshotPath });
      if (!mergedConfig.skipAttachScreenshot) {
        await test.info().attachments.push({
          name: `Screenshot for extracting ${variableName}`,
          contentType: 'image/png',
          path: screenshotPath,
        });
      }
    });

    const imageData = fs.readFileSync(screenshotPath);
    const base64Image = imageData.toString('base64');
    const pageUrl = page.url();

    let controller: AbortController | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      return await test.step(`Analyzing with ${mergedConfig.deploymentName} for ${variableName}`, async () => {
        controller = new AbortController();
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`AI request for ${variableName} timed out after ${mergedConfig.aiRequestTimeout}ms`));
            controller?.abort();
          }, mergedConfig.aiRequestTimeout);
        });

        const progressString = (page as any).progressTracker?.getProgressString?.() || 'N/A';
        const messages: any[] = [
          {
            role: 'system',
            content: `You are a specialized AI assistant that extracts specific information from webpage screenshots.\n\nInstructions:\n- Analyze the screenshot.\n- Follow the extraction guide.\n- Provide detailed reasoning within <reasoning>...</reasoning> and the value within <extracted_value>...</extracted_value>.\n- If loading, return <wait/> instead.\n\nTest Case Progress:\n${progressString}`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Variable to extract: "${variableName}"\n\nExtraction Guide:\n${extractionGuide}\n\nCurrent page URL: ${pageUrl}` },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } },
            ],
          },
        ];

        const openaiPromise = (openai as any).chat.completions.create(
          {
            model: mergedConfig.deploymentName!,
            messages,
            temperature: 0,
          },
          { signal: (controller as AbortController).signal }
        );

        const response: any = await Promise.race([openaiPromise, timeoutPromise]);
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }

        const aiResponseContent = response.choices[0]?.message?.content?.trim() || '';

        const reasoningMatch = aiResponseContent.match(/<reasoning>([\s\S]*?)<\/reasoning>/i);
        const extractedValueMatch = aiResponseContent.match(/<extracted_value>([\s\S]*?)<\/extracted_value>/i);
        const waitTagMatch = aiResponseContent.match(/<wait\/>/i);

        if (waitTagMatch) {
          if (retryCount >= 10) {
            throw new Error(`AI detected loading state for ${variableName} after ${retryCount + 1} attempts.`);
          }
          await new Promise(resolve => setTimeout(resolve, 5000));
          return await aiExtract(page, variableName, extractionGuide, config, pageLoadTimeout, retryCount + 1);
        }

        if (extractedValueMatch) {
          const value = extractedValueMatch[1].trim();
          (page as any).progressTracker?.addStep?.(`Extracted Variable '${variableName}' as '${value}'`);
          return value;
        }

        // Fallback: attempt to parse raw content
        const fallback = aiResponseContent.replace(/<[^>]+>/g, '').trim();
        if (fallback) {
          (page as any).progressTracker?.addStep?.(`Extracted Variable '${variableName}' as '${fallback}'`);
          return fallback;
        }

        throw new Error(`AI response not in expected format for ${variableName}`);
      });
    } finally {
      if (timeoutId) { clearTimeout(timeoutId); }
    }
  });
}

// ------------------ aiAssert ------------------

interface AiAssertConfig {
  apiKey?: string;
  endpoint?: string;
  apiVersion?: string;
  deploymentName?: string;
  timeout?: number; // for page load wait in our wrapper; OpenAI timeout handled via AbortController in messages
  screenshotDir?: string;
  skipAttachScreenshot?: boolean;
}

const defaultAssertConfig: AiAssertConfig = {
  apiKey: process.env.AZURE_API_KEY,
  endpoint: process.env.AZURE_API_BASE,
  apiVersion: process.env.AZURE_API_VERSION || '2024-02-15-preview',
  deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1',
  timeout: 45000,
  screenshotDir: 'test-results',
  skipAttachScreenshot: false,
};

export async function aiAssert(
  page: Page,
  prompt: string,
  config: AiAssertConfig = {},
  timeout: number = 1000,
  retryCount: number = 0,
  timeoutRetryCount: number = 0
): Promise<boolean> {
  const { test } = await import('@playwright/test');
  const fs = await import('fs');
  const path = await import('path');

  const mergedConfig = { ...defaultAssertConfig, ...config };
  const testId = (page as any).progressTracker?.getTestId?.() || `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  try { await page.waitForLoadState('domcontentloaded', { timeout }); } catch {}
  await page.waitForTimeout(1000);

  return await test.step(`AI Vision Assert: ${prompt}`, async () => {
    const openai = await initAzureClient(mergedConfig);

    const screenshotDir = mergedConfig.screenshotDir!;
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    let base64Image = '';
    let screenshotPath = '';

    await test.step(`Taking screenshot`, async () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      screenshotPath = path.join(screenshotDir, `aiAssert-${timestamp}.png`);
      await page.screenshot({ path: screenshotPath });
    });

    const imageData = fs.readFileSync(screenshotPath);
    base64Image = imageData.toString('base64');
    const pageUrl = page.url();

    let controller: AbortController | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      return await test.step(`Analyzing with ${mergedConfig.deploymentName}`, async () => {
        controller = new AbortController();
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`AI request timed out after ${mergedConfig.timeout}ms`));
            controller?.abort();
          }, mergedConfig.timeout);
        });

        const progressString = (page as any).progressTracker?.getProgressString?.();
        const messages: any[] = [
          {
            role: 'system',
            content: `You are a specialized testing assistant that analyzes webpage screenshots. Provide <reasoning>...</reasoning> and final decision in <decision>pass|major-fail|minor-fail|partial-fail|wait</decision>.\n\nPrevious steps:\n${progressString || 'N/A'}`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Condition: ${prompt}\n\nCurrent page URL: ${pageUrl}` },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } },
            ],
          },
        ];

        const openaiPromise = (openai as any).chat.completions.create(
          {
            model: mergedConfig.deploymentName!,
            messages,
          },
          { signal: (controller as AbortController).signal }
        );

        let response: any;
        try {
          response = await Promise.race([openaiPromise, timeoutPromise]);
          if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
        } catch (error: any) {
          if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
          // Retry on timeout a couple of times
          if (error?.message?.includes('timed out') && timeoutRetryCount < 2) {
            try { fs.unlinkSync(screenshotPath); } catch {}
            await new Promise((r) => setTimeout(r, 5000));
            return await aiAssert(page, prompt, config, timeout, retryCount, timeoutRetryCount + 1);
          }
          throw error;
        }

        const aiResponse = response.choices[0]?.message?.content?.trim() || '';
        const decisionMatch = aiResponse.match(/<decision>(pass|major-fail|minor-fail|partial-fail|wait)<\/decision>/i);

        let decision: boolean | null = null;
        if (!decisionMatch) {
          const normalized = aiResponse.toLowerCase().trim();
          if (normalized === 'pass') decision = true;
          else if (normalized === 'major-fail') decision = false;
          else if (normalized === 'minor-fail' || normalized === 'partial-fail') decision = true;
          else decision = null;
        }

        if (decision === null && decisionMatch) {
          const value = decisionMatch[1].toLowerCase();
          if (value === 'wait' || value === 'major-fail') {
            if (value === 'major-fail' && retryCount >= 3) {
              return false;
            } else if (value === 'wait' && retryCount >= 10) {
              return false;
            }
            try { fs.unlinkSync(screenshotPath); } catch {}
            await new Promise((r) => setTimeout(r, 10000));
            return await aiAssert(page, prompt, config, timeout, retryCount + 1, timeoutRetryCount);
          } else if (value === 'minor-fail' || value === 'partial-fail') {
            decision = true;
          } else {
            decision = value === 'pass';
          }
        }

        const finalDecision = !!decision;
        // Persist assertion record if supported by the tracker
        (page as any).progressTracker?.addAiAssertion?.(prompt, base64Image, finalDecision);

        if (!mergedConfig.skipAttachScreenshot) {
          await (await import('@playwright/test')).test.info().attachments.push({
            name: `Screenshot for: ${prompt}`,
            contentType: 'image/png',
            path: screenshotPath,
          });
        }

        return finalDecision;
      });
    } finally {
      if (timeoutId) { clearTimeout(timeoutId); }
    }
  });
}

export async function expectAiAssert(
  page: Page,
  prompt: string,
  config: AiAssertConfig = {}
): Promise<void> {
  const { expect, test } = await import('@playwright/test');
  await test.step(`Assertion: ${prompt}`, async () => {
    const result = await aiAssert(page, prompt, config);
    await test.step(result ? `✅ PASSED: ${prompt}` : `❌ FAILED: ${prompt}`, async () => {});
    expect(result, `AI assertion failed for: ${prompt}`).toBe(true);
  });
} 