import type { Page } from '../types/page';
import { aiAct } from '../ai/aiAdapter';
import { safeClick } from '../utils/safeClick';
import { safeDoubleClick } from '../utils/safeDoubleClick';

export async function clickAction(
  page: Page,
  description: string,
  selector?: string,
  options?: { variable?: string; defaultValue?: string }
): Promise<boolean> {
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

export async function doubleClickAction(
  page: Page,
  description: string,
  selector?: string,
  options?: { variable?: string; defaultValue?: string }
): Promise<boolean> {
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