"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  aiAct: () => aiAct,
  aiAssert: () => aiAssert,
  aiExtract: () => aiExtract,
  assertAction: () => assertAction,
  clickAction: () => clickAction,
  cookieAction: () => cookieAction,
  doubleClickAction: () => doubleClickAction,
  dragAction: () => dragAction,
  expectAiAssert: () => expectAiAssert,
  extractAction: () => extractAction,
  fillAction: () => fillAction,
  hoverAction: () => hoverAction,
  keypressAction: () => keypressAction,
  navigateAction: () => navigateAction,
  refreshAction: () => refreshAction,
  safeClick: () => safeClick,
  safeDoubleClick: () => safeDoubleClick,
  scrollAction: () => scrollAction,
  setStagehandInstance: () => setStagehandInstance,
  uploadFileAction: () => uploadFileAction,
  waitUntil: () => waitUntil
});
module.exports = __toCommonJS(index_exports);

// src/ai/aiAdapter.ts
var stagehandInstance = null;
function setStagehandInstance(instance) {
  stagehandInstance = instance;
}
async function getStagehandInstance() {
  if (stagehandInstance) return stagehandInstance;
  if (globalThis.stagehand) return globalThis.stagehand;
  return null;
}
async function aiAct(page, description, timeout = 3e4) {
  const testId = page.progressTracker?.getTestId?.() || `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  try {
    await page.waitForLoadState("domcontentloaded", { timeout });
  } catch {
  }
  try {
    const stagehand = await getStagehandInstance();
    if (!stagehand) {
      const observations = await page.observe(description);
      page.progressTracker?.addStep?.(`Action: ${description}`);
      return observations.length > 0;
    }
    const progressString = page.progressTracker?.getProgressString?.();
    const agent = stagehand.agent({
      provider: "openai",
      model: "computer-use-preview",
      instructions: `You are a persistent AI agent operating a web browser to perform a QA test step that Playwright failed to perform. Execute precisely the requested step and stop immediately after it is completed.

Previous steps:
${progressString || "N/A"}`
    });
    const result = await agent.execute(description);
    const success = !!result?.success;
    if (success) {
      page.progressTracker?.addStep?.(`Action: ${description}`);
    }
    return success;
  } catch {
    return false;
  }
}
var defaultExtractConfig = {
  apiKey: process.env.AZURE_API_KEY,
  endpoint: process.env.AZURE_API_BASE,
  apiVersion: process.env.AZURE_API_VERSION || "2024-02-15-preview",
  deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4.1",
  aiRequestTimeout: 18e4,
  screenshotDir: "test-results",
  skipAttachScreenshot: false
};
async function initAzureClient(config) {
  const { AzureOpenAI } = await import("openai");
  return new AzureOpenAI({
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    apiVersion: config.apiVersion
  });
}
async function aiExtract(page, variableName, extractionGuide, config = {}, pageLoadTimeout = 5e3, retryCount = 0) {
  const { test } = await import("@playwright/test");
  const fs = await import("fs");
  const path = await import("path");
  const mergedConfig = { ...defaultExtractConfig, ...config };
  const testId = page.progressTracker?.getTestId?.() || `aiExtract-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: pageLoadTimeout });
  } catch {
  }
  try {
    await page.waitForLoadState("networkidle", { timeout: pageLoadTimeout });
  } catch {
  }
  await page.waitForTimeout(1e3);
  return await test.step(`AI Extract: ${variableName} - Guide: "${extractionGuide.substring(0, 100)}..."`, async () => {
    const openai = await initAzureClient(mergedConfig);
    const screenshotDir = mergedConfig.screenshotDir;
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const screenshotPath = path.join(screenshotDir, `aiExtract-${variableName}-${timestamp}.png`);
    await test.step(`Taking screenshot for ${variableName}`, async () => {
      await page.screenshot({ path: screenshotPath });
      if (!mergedConfig.skipAttachScreenshot) {
        await test.info().attachments.push({
          name: `Screenshot for extracting ${variableName}`,
          contentType: "image/png",
          path: screenshotPath
        });
      }
    });
    const imageData = fs.readFileSync(screenshotPath);
    const base64Image = imageData.toString("base64");
    const pageUrl = page.url();
    let controller = null;
    let timeoutId = null;
    try {
      return await test.step(`Analyzing with ${mergedConfig.deploymentName} for ${variableName}`, async () => {
        controller = new AbortController();
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`AI request for ${variableName} timed out after ${mergedConfig.aiRequestTimeout}ms`));
            controller?.abort();
          }, mergedConfig.aiRequestTimeout);
        });
        const progressString = page.progressTracker?.getProgressString?.() || "N/A";
        const messages = [
          {
            role: "system",
            content: `You are a specialized AI assistant that extracts specific information from webpage screenshots.

Instructions:
- Analyze the screenshot.
- Follow the extraction guide.
- Provide detailed reasoning within <reasoning>...</reasoning> and the value within <extracted_value>...</extracted_value>.
- If loading, return <wait/> instead.

Test Case Progress:
${progressString}`
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Variable to extract: "${variableName}"

Extraction Guide:
${extractionGuide}

Current page URL: ${pageUrl}` },
              { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }
            ]
          }
        ];
        const openaiPromise = openai.chat.completions.create(
          {
            model: mergedConfig.deploymentName,
            messages,
            temperature: 0
          },
          { signal: controller.signal }
        );
        const response = await Promise.race([openaiPromise, timeoutPromise]);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        const aiResponseContent = response.choices[0]?.message?.content?.trim() || "";
        const reasoningMatch = aiResponseContent.match(/<reasoning>([\s\S]*?)<\/reasoning>/i);
        const extractedValueMatch = aiResponseContent.match(/<extracted_value>([\s\S]*?)<\/extracted_value>/i);
        const waitTagMatch = aiResponseContent.match(/<wait\/>/i);
        if (waitTagMatch) {
          if (retryCount >= 10) {
            throw new Error(`AI detected loading state for ${variableName} after ${retryCount + 1} attempts.`);
          }
          await new Promise((resolve) => setTimeout(resolve, 5e3));
          return await aiExtract(page, variableName, extractionGuide, config, pageLoadTimeout, retryCount + 1);
        }
        if (extractedValueMatch) {
          const value = extractedValueMatch[1].trim();
          page.progressTracker?.addStep?.(`Extracted Variable '${variableName}' as '${value}'`);
          return value;
        }
        const fallback = aiResponseContent.replace(/<[^>]+>/g, "").trim();
        if (fallback) {
          page.progressTracker?.addStep?.(`Extracted Variable '${variableName}' as '${fallback}'`);
          return fallback;
        }
        throw new Error(`AI response not in expected format for ${variableName}`);
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  });
}
var defaultAssertConfig = {
  apiKey: process.env.AZURE_API_KEY,
  endpoint: process.env.AZURE_API_BASE,
  apiVersion: process.env.AZURE_API_VERSION || "2024-02-15-preview",
  deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4.1",
  timeout: 45e3,
  screenshotDir: "test-results",
  skipAttachScreenshot: false
};
async function aiAssert(page, prompt, config = {}, timeout = 1e3, retryCount = 0, timeoutRetryCount = 0) {
  const { test } = await import("@playwright/test");
  const fs = await import("fs");
  const path = await import("path");
  const mergedConfig = { ...defaultAssertConfig, ...config };
  const testId = page.progressTracker?.getTestId?.() || `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  try {
    await page.waitForLoadState("domcontentloaded", { timeout });
  } catch {
  }
  await page.waitForTimeout(1e3);
  return await test.step(`AI Vision Assert: ${prompt}`, async () => {
    const openai = await initAzureClient(mergedConfig);
    const screenshotDir = mergedConfig.screenshotDir;
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    let base64Image = "";
    let screenshotPath = "";
    await test.step(`Taking screenshot`, async () => {
      const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      screenshotPath = path.join(screenshotDir, `aiAssert-${timestamp}.png`);
      await page.screenshot({ path: screenshotPath });
    });
    const imageData = fs.readFileSync(screenshotPath);
    base64Image = imageData.toString("base64");
    const pageUrl = page.url();
    let controller = null;
    let timeoutId = null;
    try {
      return await test.step(`Analyzing with ${mergedConfig.deploymentName}`, async () => {
        controller = new AbortController();
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`AI request timed out after ${mergedConfig.timeout}ms`));
            controller?.abort();
          }, mergedConfig.timeout);
        });
        const progressString = page.progressTracker?.getProgressString?.();
        const messages = [
          {
            role: "system",
            content: `You are a specialized testing assistant that analyzes webpage screenshots. Provide <reasoning>...</reasoning> and final decision in <decision>pass|major-fail|minor-fail|partial-fail|wait</decision>.

Previous steps:
${progressString || "N/A"}`
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Condition: ${prompt}

Current page URL: ${pageUrl}` },
              { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }
            ]
          }
        ];
        const openaiPromise = openai.chat.completions.create(
          {
            model: mergedConfig.deploymentName,
            messages
          },
          { signal: controller.signal }
        );
        let response;
        try {
          response = await Promise.race([openaiPromise, timeoutPromise]);
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        } catch (error) {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          if (error?.message?.includes("timed out") && timeoutRetryCount < 2) {
            try {
              fs.unlinkSync(screenshotPath);
            } catch {
            }
            await new Promise((r) => setTimeout(r, 5e3));
            return await aiAssert(page, prompt, config, timeout, retryCount, timeoutRetryCount + 1);
          }
          throw error;
        }
        const aiResponse = response.choices[0]?.message?.content?.trim() || "";
        const decisionMatch = aiResponse.match(/<decision>(pass|major-fail|minor-fail|partial-fail|wait)<\/decision>/i);
        let decision = null;
        if (!decisionMatch) {
          const normalized = aiResponse.toLowerCase().trim();
          if (normalized === "pass") decision = true;
          else if (normalized === "major-fail") decision = false;
          else if (normalized === "minor-fail" || normalized === "partial-fail") decision = true;
          else decision = null;
        }
        if (decision === null && decisionMatch) {
          const value = decisionMatch[1].toLowerCase();
          if (value === "wait" || value === "major-fail") {
            if (value === "major-fail" && retryCount >= 3) {
              return false;
            } else if (value === "wait" && retryCount >= 10) {
              return false;
            }
            try {
              fs.unlinkSync(screenshotPath);
            } catch {
            }
            await new Promise((r) => setTimeout(r, 1e4));
            return await aiAssert(page, prompt, config, timeout, retryCount + 1, timeoutRetryCount);
          } else if (value === "minor-fail" || value === "partial-fail") {
            decision = true;
          } else {
            decision = value === "pass";
          }
        }
        const finalDecision = !!decision;
        page.progressTracker?.addAiAssertion?.(prompt, base64Image, finalDecision);
        if (!mergedConfig.skipAttachScreenshot) {
          await (await import("@playwright/test")).test.info().attachments.push({
            name: `Screenshot for: ${prompt}`,
            contentType: "image/png",
            path: screenshotPath
          });
        }
        return finalDecision;
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  });
}
async function expectAiAssert(page, prompt, config = {}) {
  const { expect, test } = await import("@playwright/test");
  await test.step(`Assertion: ${prompt}`, async () => {
    const result = await aiAssert(page, prompt, config);
    await test.step(result ? `\u2705 PASSED: ${prompt}` : `\u274C FAILED: ${prompt}`, async () => {
    });
    expect(result, `AI assertion failed for: ${prompt}`).toBe(true);
  });
}

// src/auto/setup.ts
var initialized = false;
function setupTestsmith() {
  if (initialized) return;
  initialized = true;
  try {
    const maybeStagehand = require("stagehand");
    if (maybeStagehand) {
      setStagehandInstance(maybeStagehand);
    }
  } catch {
  }
  if (globalThis.stagehand) {
    setStagehandInstance(globalThis.stagehand);
  }
}

// src/utils/safeClick.ts
async function safeClick(page, selector) {
  try {
    const locator = page.locator(selector);
    await locator.waitFor({ state: "visible", timeout: 1e4 });
    await locator.click();
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

// src/utils/safeDoubleClick.ts
async function safeDoubleClick(page, selector) {
  try {
    const locator = page.locator(selector);
    await locator.waitFor({ state: "visible", timeout: 1e4 });
    await locator.dblclick();
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

// src/actions/click.ts
async function clickAction(page, description, selector, options) {
  let actionSuccess = false;
  if (selector) {
    if (options?.variable && options?.defaultValue) {
      if (options.variable === options.defaultValue) {
        const clickResult = await safeClick(page, selector);
        actionSuccess = clickResult.success;
      }
    } else {
      const clickResult = await safeClick(page, selector);
      actionSuccess = clickResult.success;
    }
  }
  if (!actionSuccess) {
    actionSuccess = await aiAct(page, description);
  }
  page.progressTracker.addStep(description, actionSuccess);
  return actionSuccess;
}
async function doubleClickAction(page, description, selector, options) {
  let actionSuccess = false;
  if (selector) {
    if (options?.variable && options?.defaultValue) {
      if (options.variable === options.defaultValue) {
        const clickResult = await safeDoubleClick(page, selector);
        actionSuccess = clickResult.success;
      }
    } else {
      const clickResult = await safeDoubleClick(page, selector);
      actionSuccess = clickResult.success;
    }
  }
  if (!actionSuccess) {
    actionSuccess = await aiAct(page, description);
  }
  page.progressTracker.addStep(description, actionSuccess);
  return actionSuccess;
}

// src/actions/hover.ts
async function hoverAction(page, description, selector, options) {
  let actionSuccess = false;
  if (selector) {
    if (options?.variable && options?.defaultValue) {
      if (options.variable === options.defaultValue) {
        try {
          const locator = page.locator(selector);
          await locator.waitFor({ state: "visible", timeout: 1e4 });
          await locator.hover();
          actionSuccess = true;
        } catch {
          actionSuccess = false;
        }
      }
    } else {
      try {
        const locator = page.locator(selector);
        await locator.waitFor({ state: "visible", timeout: 1e4 });
        await locator.hover();
        actionSuccess = true;
      } catch {
        actionSuccess = false;
      }
    }
  }
  if (!actionSuccess) {
    actionSuccess = await aiAct(page, description);
  }
  page.progressTracker.addStep(description, actionSuccess);
  return actionSuccess;
}

// src/actions/drag.ts
async function dragAction(page, description, sourceSelector, dragOptions) {
  let actionSuccess = false;
  if (sourceSelector) {
    const shouldUseDrag = !dragOptions?.variable || !dragOptions?.defaultValue || dragOptions.variable === dragOptions.defaultValue;
    if (shouldUseDrag) {
      try {
        const sourceLocator = page.locator(sourceSelector);
        await sourceLocator.waitFor({ state: "visible", timeout: 1e4 });
        if (dragOptions?.targetSelector) {
          const targetLocator = page.locator(dragOptions.targetSelector);
          await targetLocator.waitFor({ state: "visible", timeout: 1e4 });
          await sourceLocator.dragTo(targetLocator);
          actionSuccess = true;
        } else if (dragOptions?.offset) {
          const sourceBox = await sourceLocator.boundingBox();
          if (sourceBox) {
            await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
            await page.mouse.down();
            await page.mouse.move(
              sourceBox.x + sourceBox.width / 2 + dragOptions.offset.x,
              sourceBox.y + sourceBox.height / 2 + dragOptions.offset.y
            );
            await page.mouse.up();
            actionSuccess = true;
          }
        } else {
          const sourceBox = await sourceLocator.boundingBox();
          if (sourceBox) {
            await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
            await page.mouse.down();
            await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 10, sourceBox.y + sourceBox.height / 2 + 10);
            await page.mouse.up();
            actionSuccess = true;
          }
        }
      } catch {
        actionSuccess = false;
      }
    }
  }
  if (!actionSuccess) {
    actionSuccess = await aiAct(page, description);
  }
  page.progressTracker.addStep(description, actionSuccess);
  return actionSuccess;
}

// src/actions/scroll.ts
async function scrollAction(page, description, selector, scrollOptions) {
  let actionSuccess = false;
  let deltaX = scrollOptions?.deltaX ?? 0;
  let deltaY = scrollOptions?.deltaY ?? 0;
  if (scrollOptions?.direction) {
    const scrollAmount = typeof scrollOptions.amount === "number" ? scrollOptions.amount : scrollOptions?.amount === "small" ? 100 : scrollOptions?.amount === "large" ? 500 : 300;
    switch (scrollOptions.direction) {
      case "up":
        deltaY = -scrollAmount;
        break;
      case "down":
        deltaY = scrollAmount;
        break;
      case "left":
        deltaX = -scrollAmount;
        break;
      case "right":
        deltaX = scrollAmount;
        break;
    }
  }
  if (deltaX === 0 && deltaY === 0 && !scrollOptions?.scrollToSelector) {
    deltaY = 300;
  }
  if (selector || scrollOptions?.scrollToSelector) {
    const shouldUseScroll = !scrollOptions?.variable || !scrollOptions?.defaultValue || scrollOptions.variable === scrollOptions.defaultValue;
    if (shouldUseScroll) {
      try {
        if (scrollOptions?.scrollToSelector) {
          const targetLocator = page.locator(scrollOptions.scrollToSelector);
          await targetLocator.waitFor({ state: "visible", timeout: 1e4 });
          await targetLocator.scrollIntoViewIfNeeded();
          actionSuccess = true;
        } else if (selector) {
          const locator = page.locator(selector);
          await locator.waitFor({ state: "visible", timeout: 1e4 });
          await locator.hover();
          await page.mouse.wheel(deltaX, deltaY);
          actionSuccess = true;
        }
      } catch {
        actionSuccess = false;
      }
    }
  } else {
    try {
      await page.mouse.wheel(deltaX, deltaY);
      actionSuccess = true;
    } catch {
      actionSuccess = false;
    }
  }
  if (!actionSuccess) {
    actionSuccess = await aiAct(page, description);
  }
  page.progressTracker.addStep(description, actionSuccess);
  return actionSuccess;
}

// src/actions/keypress.ts
async function keypressAction(page, description, keys, selector, options) {
  let actionSuccess = false;
  const keyString = Array.isArray(keys) ? keys.join("+") : keys;
  const normalizeKey = (key) => {
    const keyMap = {
      "CTRL": "Control",
      "ALT": "Alt",
      "SHIFT": "Shift",
      "ENTER": "Enter",
      "ESC": "Escape",
      "SPACE": " ",
      "TAB": "Tab",
      "DELETE": "Delete",
      "BACKSPACE": "Backspace",
      "ARROW_UP": "ArrowUp",
      "ARROW_DOWN": "ArrowDown",
      "ARROW_LEFT": "ArrowLeft",
      "ARROW_RIGHT": "ArrowRight",
      "HOME": "Home",
      "END": "End",
      "PAGE_UP": "PageUp",
      "PAGE_DOWN": "PageDown"
    };
    return keyMap[key.toUpperCase()] || key;
  };
  const normalizedKeys = Array.isArray(keys) ? keys.map(normalizeKey).join("+") : normalizeKey(keyString);
  if (selector) {
    const shouldUseKeypress = !options?.variable || !options?.defaultValue || options.variable === options.defaultValue;
    if (shouldUseKeypress) {
      try {
        const locator = page.locator(selector);
        await locator.waitFor({ state: "visible", timeout: 1e4 });
        if (options?.focusFirst !== false) {
          const clickResult = await safeClick(page, selector);
          if (!clickResult.success) {
            await locator.focus();
          }
        }
        await page.keyboard.press(normalizedKeys);
        actionSuccess = true;
      } catch {
        actionSuccess = false;
      }
    }
  } else {
    try {
      await page.keyboard.press(normalizedKeys);
      actionSuccess = true;
    } catch {
      actionSuccess = false;
    }
  }
  if (!actionSuccess) {
    actionSuccess = await aiAct(page, description);
  }
  page.progressTracker.addStep(description, actionSuccess);
  return actionSuccess;
}

// src/actions/cookie.ts
async function cookieAction(page, cookieData, description, options) {
  let actionSuccess = false;
  const cookies = Array.isArray(cookieData) ? cookieData : [cookieData];
  let actionDescription = description;
  if (!actionDescription) {
    if (cookies.length === 1) {
      actionDescription = `Injected cookie ${cookies[0].name}`;
    } else {
      const cookieNames = cookies.map((c) => c.name).join(", ");
      actionDescription = `Injected cookies: ${cookieNames}`;
    }
  }
  const escapeCookieValue = (value) => {
    return value.replace(/[";,\s]/g, (match) => {
      switch (match) {
        case '"':
          return '\\"';
        case ";":
          return "\\;";
        case ",":
          return "\\,";
        case " ":
          return "%20";
        default:
          return match;
      }
    });
  };
  const processedCookies = cookies.map((cookie) => ({
    name: cookie.name,
    value: escapeCookieValue(cookie.value),
    domain: cookie.domain,
    path: cookie.path || "/",
    expires: cookie.expires,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite
  }));
  const shouldInjectCookies = !options?.variable || !options?.defaultValue || options.variable === options.defaultValue;
  if (shouldInjectCookies) {
    try {
      await page.context().addCookies(processedCookies);
      actionSuccess = true;
    } catch (e) {
      actionSuccess = false;
    }
  } else {
    actionSuccess = true;
  }
  page.progressTracker.addStep(actionDescription, actionSuccess);
  return actionSuccess;
}

// src/actions/fill.ts
async function fillAction(page, description, value, selector, options) {
  let actionSuccess = false;
  if (selector) {
    if (options?.variable && options?.defaultValue) {
      if (options.variable === options.defaultValue) {
        try {
          const locator = page.locator(selector);
          await locator.waitFor({ state: "visible", timeout: 1e4 });
          await locator.fill(value);
          actionSuccess = true;
        } catch {
          actionSuccess = false;
        }
      }
    } else {
      try {
        const locator = page.locator(selector);
        await locator.waitFor({ state: "visible", timeout: 1e4 });
        await locator.fill(value);
        actionSuccess = true;
      } catch {
        actionSuccess = false;
      }
    }
  }
  if (!actionSuccess) {
    const aiDescription = `${description}. Fill the field with the value: ${value}`;
    actionSuccess = await aiAct(page, aiDescription);
  }
  page.progressTracker.addStep(description, actionSuccess);
  return actionSuccess;
}

// src/actions/upload.ts
async function uploadFileAction(page, description, filePaths, selector) {
  let actionSuccess = false;
  const filesArray = Array.isArray(filePaths) ? filePaths : [filePaths];
  if (selector) {
    try {
      const locator = page.locator(selector);
      await locator.waitFor({ state: "attached", timeout: 1e4 });
      await locator.setInputFiles(filesArray);
      actionSuccess = true;
    } catch {
      actionSuccess = false;
    }
  }
  if (!actionSuccess) {
    try {
      const observations = await page.observe(description);
      if (observations.length > 0) {
        const fileInputObservations = observations.filter(
          (obs) => obs.selector && (obs.selector.includes('input[type="file"]') || obs.selector.includes("input[type=file]") || obs.description.toLowerCase().includes("file input") || obs.description.toLowerCase().includes("input file"))
        );
        let bestCandidate = fileInputObservations[0] ?? observations[0];
        if (bestCandidate?.selector) {
          const locator = page.locator(bestCandidate.selector);
          try {
            await locator.waitFor({ state: "attached", timeout: 1e4 });
            await locator.setInputFiles(filesArray);
            actionSuccess = true;
          } catch {
            if (!bestCandidate.selector.includes('input[type="file"]')) {
              try {
                await locator.click();
                await page.waitForTimeout(1e3);
                const fileInput = page.locator('input[type="file"]').first();
                await fileInput.waitFor({ state: "attached", timeout: 5e3 });
                await fileInput.setInputFiles(filesArray);
                actionSuccess = true;
              } catch {
                actionSuccess = false;
              }
            }
          }
        }
      }
    } catch {
      actionSuccess = false;
    }
  }
  page.progressTracker.addStep(description, actionSuccess);
  return actionSuccess;
}

// src/actions/extract.ts
async function extractAction(page, variableName, description) {
  const extractedValue = await aiExtract(page, variableName, description);
  page.progressTracker.addStep(`Extracted Variable '${variableName}' as '${extractedValue}'`);
  return extractedValue;
}
async function assertAction(page, description) {
  await expectAiAssert(page, description);
  page.progressTracker.addStep(description);
}

// src/actions/waitUntil.ts
var WAIT_UNTIL_INTERVAL_MS = 1e4;
var WAIT_UNTIL_TIMEOUT_MS = 3e5;
async function waitUntil(page, condition) {
  const startTime = Date.now();
  let conditionMet = false;
  while (Date.now() - startTime < WAIT_UNTIL_TIMEOUT_MS) {
    try {
      conditionMet = await aiAssert(page, condition, { timeout: WAIT_UNTIL_TIMEOUT_MS });
    } catch {
      conditionMet = false;
    }
    if (conditionMet) {
      break;
    }
    await page.waitForTimeout(WAIT_UNTIL_INTERVAL_MS);
  }
  const description = `Wait until condition met: ${condition}`;
  page.progressTracker.addStep(description, conditionMet);
  return conditionMet;
}

// src/actions/navigation.ts
async function navigateAction(page, url, description) {
  const actionDescription = description || `Navigated to ${url}`;
  await page.waitForTimeout(1e3);
  await page.goto(url).catch(() => {
  });
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: 1e4 });
  } catch {
  }
  try {
    await page.waitForLoadState("networkidle", { timeout: 1e4 });
  } catch {
  }
  page.progressTracker.addStep(actionDescription);
}
async function refreshAction(page, description) {
  const actionDescription = description || "Refreshed the page";
  await page.reload();
  page.progressTracker.addStep(actionDescription);
}

// src/index.ts
setupTestsmith();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  aiAct,
  aiAssert,
  aiExtract,
  assertAction,
  clickAction,
  cookieAction,
  doubleClickAction,
  dragAction,
  expectAiAssert,
  extractAction,
  fillAction,
  hoverAction,
  keypressAction,
  navigateAction,
  refreshAction,
  safeClick,
  safeDoubleClick,
  scrollAction,
  setStagehandInstance,
  uploadFileAction,
  waitUntil
});
//# sourceMappingURL=index.cjs.map