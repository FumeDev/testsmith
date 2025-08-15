import type { Page } from '../types/page';
import { aiExtract, expectAiAssert } from '../ai/aiAdapter';

export async function extractAction(
  page: Page,
  variableName: string,
  description: string
): Promise<string> {
  const extractedValue = await aiExtract(page, variableName, description);
  page.progressTracker.addStep(`Extracted Variable '${variableName}' as '${extractedValue}'`);
  return extractedValue;
}

export async function assertAction(
  page: Page,
  description: string
): Promise<void> {
  await expectAiAssert(page, description);
  page.progressTracker.addStep(description);
} 