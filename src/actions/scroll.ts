import type { Page } from '../types/page';
import { aiAct } from '../ai/aiAdapter';

export async function scrollAction(
  page: Page,
  description: string,
  selector?: string,
  scrollOptions?: {
    deltaX?: number;
    deltaY?: number;
    direction?: 'up' | 'down' | 'left' | 'right';
    amount?: 'small' | 'medium' | 'large' | number;
    scrollToSelector?: string;
    variable?: string;
    defaultValue?: string;
  }
): Promise<boolean> {
  let actionSuccess = false;

  let deltaX = scrollOptions?.deltaX ?? 0;
  let deltaY = scrollOptions?.deltaY ?? 0;

  if (scrollOptions?.direction) {
    const scrollAmount = typeof scrollOptions.amount === 'number'
      ? scrollOptions.amount
      : scrollOptions?.amount === 'small' ? 100
      : scrollOptions?.amount === 'large' ? 500
      : 300;

    switch (scrollOptions.direction) {
      case 'up': deltaY = -scrollAmount; break;
      case 'down': deltaY = scrollAmount; break;
      case 'left': deltaX = -scrollAmount; break;
      case 'right': deltaX = scrollAmount; break;
    }
  }

  if (deltaX === 0 && deltaY === 0 && !scrollOptions?.scrollToSelector) {
    deltaY = 300;
  }

  if (selector || scrollOptions?.scrollToSelector) {
    const shouldUseScroll = !scrollOptions?.variable || !scrollOptions?.defaultValue ||
      (scrollOptions.variable === scrollOptions.defaultValue);

    if (shouldUseScroll) {
      try {
        if (scrollOptions?.scrollToSelector) {
          const targetLocator = page.locator(scrollOptions.scrollToSelector);
          await targetLocator.waitFor({ state: 'visible', timeout: 10000 });
          await targetLocator.scrollIntoViewIfNeeded();
          actionSuccess = true;
        } else if (selector) {
          const locator = page.locator(selector);
          await locator.waitFor({ state: 'visible', timeout: 10000 });
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