import { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Attempts to safely click on an element on the page
 * Returns a success indicator that will be false if the click fails or times out
 *
 * @param page - Playwright Page object
 * @param selector - CSS selector for the element to click
 * @param options - Optional parameters including timeout
 * @returns Object with success boolean indicating if click was successful
 *
 * @example
 * ```ts
 * // Try to click on a button with a timeout
 * const result = await safeClick(page, 'button.submit', { timeout: 5000 });
 * if (!result.success) {
 *   console.log('Click operation failed or timed out');
 * }
 * ```
 */
export async function safeClick(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
): Promise<{ success: boolean }> {
  const timeout = options.timeout || 5000;

  try {
    // Wait for the page to be fully loaded before performing the action
    try {
      await page.waitForLoadState("domcontentloaded", { timeout });
    } catch (error) {
      console.log(
        `domcontentloaded wait timed out, continuing with AI assertion anyway`
      );
      // Continue without error - this is expected in some cases
    }

    try {
      await page.waitForLoadState("networkidle", { timeout });
    } catch (error) {
      console.log(
        `networkidle wait timed out, continuing with AI assertion anyway`
      );
      // Continue without error - this is expected in some cases
    }

    // Get the element using locator
    const locator = page.locator(selector);

    // Wait for the element to be visible and enabled
    await locator.waitFor({
      state: "visible",
      timeout,
    });

    // Additionally ensure the element is enabled
    await expect(locator).toBeEnabled({ timeout });

    // Scroll the element into view if needed
    await locator.scrollIntoViewIfNeeded({ timeout });

    // Add a small delay to ensure element is fully interactable
    await page.waitForTimeout(100);

    // Create a promise that resolves when the click is successful
    const clickPromise = locator.click({ timeout });

    // Create a timeout promise
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve("timeout"), timeout);
    });

    // Race the click operation against the timeout
    const result = await Promise.race([
      clickPromise.then(() => "success"),
      timeoutPromise,
    ]);

    return { success: result === "success" };
  } catch (error) {
    return { success: false };
  }
}
