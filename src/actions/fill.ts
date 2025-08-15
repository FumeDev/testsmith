import type { Page } from '../types/page';
import { aiAct } from '../ai/aiAdapter';

export async function fillAction(
  page: Page,
  description: string,
  value: string,
  selector?: string,
  options?: { variable?: string; defaultValue?: string }
): Promise<boolean> {
  let actionSuccess = false;

  if (selector) {
    if (options?.variable && options?.defaultValue) {
      if (options.variable === options.defaultValue) {
        try {
          const locator = page.locator(selector);
          await locator.waitFor({ state: 'visible', timeout: 10000 });
          await locator.fill(value);
          actionSuccess = true;
        } catch {
          actionSuccess = false;
        }
      }
    } else {
      try {
        const locator = page.locator(selector);
        await locator.waitFor({ state: 'visible', timeout: 10000 });
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