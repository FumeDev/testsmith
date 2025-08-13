import { Page as PlaywrightPage } from '@playwright/test';
import { getAiAct, getAiExtract, getAiAssert, getExpectAiAssert } from './aiAdapter';

// Narrow Page type to Playwright's Page with optional progressTracker used by utils
export type Page = PlaywrightPage & { progressTracker?: { addStep: (desc: string, success?: boolean) => void } };

/**
 * Wrapper for click actions with fallback to AI
 */
export async function clickAction(
  page: Page,
  description: string,
  selector?: string,
  options?: { variable?: string; defaultValue?: string }
): Promise<boolean> {
  let actionSuccess = false;

  if (selector) {
    const shouldUseSelector = options?.variable && options?.defaultValue
      ? options.variable === options.defaultValue
      : true;

    if (shouldUseSelector) {
      try {
        const locator = page.locator(selector);
        await locator.waitFor({ state: 'visible', timeout: 10000 });
        await locator.click();
        actionSuccess = true;
      } catch {
        actionSuccess = false;
      }
    }
  }

  if (!actionSuccess) {
    actionSuccess = await getAiAct()(page, description);
  }

  page.progressTracker?.addStep(description, actionSuccess);
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
    const shouldUseSelector = options?.variable && options?.defaultValue
      ? options.variable === options.defaultValue
      : true;

    if (shouldUseSelector) {
      try {
        const locator = page.locator(selector);
        await locator.waitFor({ state: 'visible', timeout: 10000 });
        await locator.dblclick();
        actionSuccess = true;
      } catch {
        actionSuccess = false;
      }
    }
  }

  if (!actionSuccess) {
    actionSuccess = await getAiAct()(page, description);
  }

  page.progressTracker?.addStep(description, actionSuccess);
  return actionSuccess;
}

export async function hoverAction(
  page: Page,
  description: string,
  selector?: string,
  options?: { variable?: string; defaultValue?: string }
): Promise<boolean> {
  let actionSuccess = false;

  if (selector) {
    const shouldUseSelector = options?.variable && options?.defaultValue
      ? options.variable === options.defaultValue
      : true;

    if (shouldUseSelector) {
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
    actionSuccess = await getAiAct()(page, description);
  }

  page.progressTracker?.addStep(description, actionSuccess);
  return actionSuccess;
}

export async function dragAction(
  page: Page,
  description: string,
  sourceSelector?: string,
  dragOptions?: { targetSelector?: string; offset?: { x: number; y: number }; variable?: string; defaultValue?: string }
): Promise<boolean> {
  let actionSuccess = false;

  if (sourceSelector) {
    const shouldUseDrag = !dragOptions?.variable || !dragOptions?.defaultValue || (dragOptions.variable === dragOptions.defaultValue);

    if (shouldUseDrag) {
      try {
        const sourceLocator = page.locator(sourceSelector);
        await sourceLocator.waitFor({ state: 'visible', timeout: 10000 });

        if (dragOptions?.targetSelector) {
          const targetLocator = page.locator(dragOptions.targetSelector);
          await targetLocator.waitFor({ state: 'visible', timeout: 10000 });
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
    actionSuccess = await getAiAct()(page, description);
  }

  page.progressTracker?.addStep(description, actionSuccess);
  return actionSuccess;
}

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
    const shouldUseScroll = !scrollOptions?.variable || !scrollOptions?.defaultValue || (scrollOptions.variable === scrollOptions.defaultValue);

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
    actionSuccess = await getAiAct()(page, description);
  }

  page.progressTracker?.addStep(description, actionSuccess);
  return actionSuccess;
}

export async function keypressAction(
  page: Page,
  description: string,
  keys: string | string[],
  selector?: string,
  options?: { variable?: string; defaultValue?: string; focusFirst?: boolean }
): Promise<boolean> {
  let actionSuccess = false;

  const keyString = Array.isArray(keys) ? keys.join('+') : keys;
  const normalizeKey = (key: string): string => {
    const keyMap: { [key: string]: string } = {
      'CTRL': 'Control', 'ALT': 'Alt', 'SHIFT': 'Shift', 'ENTER': 'Enter', 'ESC': 'Escape', 'SPACE': ' ', 'TAB': 'Tab',
      'DELETE': 'Delete', 'BACKSPACE': 'Backspace', 'ARROW_UP': 'ArrowUp', 'ARROW_DOWN': 'ArrowDown', 'ARROW_LEFT': 'ArrowLeft', 'ARROW_RIGHT': 'ArrowRight',
      'HOME': 'Home', 'END': 'End', 'PAGE_UP': 'PageUp', 'PAGE_DOWN': 'PageDown'
    };
    return keyMap[key.toUpperCase()] || key;
  };
  const normalizedKeys = Array.isArray(keys) ? keys.map(normalizeKey).join('+') : normalizeKey(keyString);

  if (selector) {
    const shouldUseKeypress = !options?.variable || !options?.defaultValue || (options.variable === options.defaultValue);

    if (shouldUseKeypress) {
      try {
        const locator = page.locator(selector);
        await locator.waitFor({ state: 'visible', timeout: 10000 });

        if (options?.focusFirst !== false) {
          try { await locator.click(); } catch { await locator.focus(); }
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
    actionSuccess = await getAiAct()(page, description);
  }

  page.progressTracker?.addStep(description, actionSuccess);
  return actionSuccess;
}

interface CookieData { name: string; value: string; domain: string; path?: string; expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: 'Strict' | 'Lax' | 'None'; }

export async function cookieAction(
  page: Page,
  cookieData: CookieData | CookieData[],
  description?: string,
  options?: { variable?: string; defaultValue?: string }
): Promise<boolean> {
  let actionSuccess = false;
  const cookies = Array.isArray(cookieData) ? cookieData : [cookieData];

  let actionDescription = description;
  if (!actionDescription) {
    actionDescription = cookies.length === 1 ? `Injected cookie ${cookies[0].name}` : `Injected cookies: ${cookies.map(c => c.name).join(', ')}`;
  }

  const escapeCookieValue = (value: string): string => value.replace(/[";,\s]/g, (match) => {
    switch (match) { case '"': return '\\"'; case ';': return '\\;'; case ',': return '\\,'; case ' ': return '%20'; default: return match; }
  });

  const processedCookies = cookies.map(c => ({
    name: c.name,
    value: escapeCookieValue(c.value),
    domain: c.domain,
    path: c.path || '/',
    expires: c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite
  }));

  const shouldInject = !options?.variable || !options?.defaultValue || (options.variable === options.defaultValue);

  if (shouldInject) {
    try { await page.context().addCookies(processedCookies); actionSuccess = true; } catch { actionSuccess = false; }
  } else {
    actionSuccess = true;
  }

  page.progressTracker?.addStep(actionDescription!, actionSuccess);
  return actionSuccess;
}

export async function extractAction(
  page: Page,
  variableName: string,
  description: string
): Promise<string> {
  const extractedValue = await getAiExtract()(page, variableName, description);
  page.progressTracker?.addStep(`Extracted Variable '${variableName}' as '${extractedValue}'`);
  return extractedValue;
}

export async function assertAction(
  page: Page,
  description: string
): Promise<void> {
  await getExpectAiAssert()(page, description);
  page.progressTracker?.addStep(description);
}

export const WAIT_UNTIL_INTERVAL_MS = 10000;
export const WAIT_UNTIL_TIMEOUT_MS = 300000;

export async function waitUntil(
  page: Page,
  condition: string
): Promise<boolean> {
  const startTime = Date.now();
  let conditionMet = false;

  while (Date.now() - startTime < WAIT_UNTIL_TIMEOUT_MS) {
    try {
      conditionMet = await getAiAssert()(page, condition, { timeout: WAIT_UNTIL_TIMEOUT_MS });
    } catch {
      conditionMet = false;
    }
    if (conditionMet) break;
    await page.waitForTimeout(WAIT_UNTIL_INTERVAL_MS);
  }

  const description = `Wait until condition met: ${condition}`;
  page.progressTracker?.addStep(description, conditionMet);
  return conditionMet;
}

export async function navigateAction(
  page: Page,
  url: string,
  description?: string
): Promise<void> {
  const actionDescription = description || `Navigated to ${url}`;
  await page.waitForTimeout(1000);
  await page.goto(url).catch(() => {});
  try { await page.waitForLoadState('domcontentloaded', { timeout: 10000 }); } catch {}
  try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch {}
  page.progressTracker?.addStep(actionDescription);
}

export async function refreshAction(
  page: Page,
  description?: string
): Promise<void> {
  const actionDescription = description || `Refreshed the page`;
  await page.reload();
  page.progressTracker?.addStep(actionDescription);
}