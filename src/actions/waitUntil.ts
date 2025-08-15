import type { Page } from '../types/page';
import { aiAssert } from '../ai/aiAdapter';

const WAIT_UNTIL_INTERVAL_MS = 10000;
const WAIT_UNTIL_TIMEOUT_MS = 300000;

export async function waitUntil(page: Page, condition: string): Promise<boolean> {
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