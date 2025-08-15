import type { Page } from '../types/page';
import { aiAct } from '../ai/aiAdapter';
import { safeClick } from '../utils/safeClick';

export async function keypressAction(
  page: Page,
  description: string,
  keys: string | string[],
  selector?: string,
  options?: {
    variable?: string;
    defaultValue?: string;
    focusFirst?: boolean;
  }
): Promise<boolean> {
  let actionSuccess = false;

  const keyString = Array.isArray(keys) ? keys.join('+') : keys;

  const normalizeKey = (key: string): string => {
    const keyMap: { [key: string]: string } = {
      'CTRL': 'Control',
      'ALT': 'Alt',
      'SHIFT': 'Shift',
      'ENTER': 'Enter',
      'ESC': 'Escape',
      'SPACE': ' ',
      'TAB': 'Tab',
      'DELETE': 'Delete',
      'BACKSPACE': 'Backspace',
      'ARROW_UP': 'ArrowUp',
      'ARROW_DOWN': 'ArrowDown',
      'ARROW_LEFT': 'ArrowLeft',
      'ARROW_RIGHT': 'ArrowRight',
      'HOME': 'Home',
      'END': 'End',
      'PAGE_UP': 'PageUp',
      'PAGE_DOWN': 'PageDown'
    };

    return keyMap[key.toUpperCase()] || key;
  };

  const normalizedKeys = Array.isArray(keys)
    ? keys.map(normalizeKey).join('+')
    : normalizeKey(keyString);

  if (selector) {
    const shouldUseKeypress = !options?.variable || !options?.defaultValue ||
      (options.variable === options.defaultValue);

    if (shouldUseKeypress) {
      try {
        const locator = page.locator(selector);
        await locator.waitFor({ state: 'visible', timeout: 10000 });

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