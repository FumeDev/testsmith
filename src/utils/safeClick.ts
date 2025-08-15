import type { Page } from '../types/page';

export async function safeClick(page: Page, selector: string): Promise<{ success: boolean }> {
  try {
    const locator = page.locator(selector);
    await locator.waitFor({ state: 'visible', timeout: 10000 });
    await locator.click();
    return { success: true };
  } catch (error) {
    return { success: false };
  }
} 