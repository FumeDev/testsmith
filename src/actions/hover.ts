import type { Page } from '../types/page';
import { aiAct } from '../ai/aiAdapter';

export async function hoverAction(
  page: Page,
  description: string,
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
          await locator.hover();
          actionSuccess = true;
        } catch {
          actionSuccess = false;
        }
      }
    } else {
      try {
        const locator = page.locator(selector);
        await locator.waitFor({ state: 'visible', timeout: 10000 });
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