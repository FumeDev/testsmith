import type { Page } from '../types/page';

export async function navigateAction(
  page: Page,
  url: string,
  description?: string
): Promise<void> {
  const actionDescription = description || `Navigated to ${url}`;

  await page.waitForTimeout(1000);
  await page.goto(url).catch(() => {});

  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
  } catch {
    // ignore
  }

  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {
    // ignore
  }

  page.progressTracker.addStep(actionDescription);
}

export async function refreshAction(
  page: Page,
  description?: string
): Promise<void> {
  const actionDescription = description || 'Refreshed the page';
  await page.reload();
  page.progressTracker.addStep(actionDescription);
} 