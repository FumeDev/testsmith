import type { Page as PlaywrightPage } from '@playwright/test';
import type { Page } from '../types/page';

export async function uploadFileAction(
  page: PlaywrightPage,
  description: string,
  filePaths: string | string[],
  selector?: string
): Promise<boolean> {
  let actionSuccess = false;

  const filesArray = Array.isArray(filePaths) ? filePaths : [filePaths];

  if (selector) {
    try {
      const locator = page.locator(selector);
      await locator.waitFor({ state: 'attached', timeout: 10000 });
      await locator.setInputFiles(filesArray);
      actionSuccess = true;
    } catch {
      actionSuccess = false;
    }
  }

  if (!actionSuccess) {
    try {
      const observations = await (page as unknown as Page).observe(description);
      if (observations.length > 0) {
        const fileInputObservations = observations.filter(obs =>
          obs.selector && (
            (obs.selector as string).includes('input[type="file"]') ||
            (obs.selector as string).includes('input[type=file]') ||
            obs.description.toLowerCase().includes('file input') ||
            obs.description.toLowerCase().includes('input file')
          )
        );

        let bestCandidate = fileInputObservations[0] ?? observations[0];

        if (bestCandidate?.selector) {
          const locator = page.locator(bestCandidate.selector as string);
          try {
            await locator.waitFor({ state: 'attached', timeout: 10000 });
            await locator.setInputFiles(filesArray);
            actionSuccess = true;
          } catch {
            if (!(bestCandidate.selector as string).includes('input[type="file"]')) {
              try {
                await locator.click();
                await page.waitForTimeout(1000);
                const fileInput = page.locator('input[type="file"]').first();
                await fileInput.waitFor({ state: 'attached', timeout: 5000 });
                await fileInput.setInputFiles(filesArray);
                actionSuccess = true;
              } catch {
                actionSuccess = false;
              }
            }
          }
        }
      }
    } catch {
      actionSuccess = false;
    }
  }

  (page as unknown as Page).progressTracker.addStep(description, actionSuccess);
  return actionSuccess;
} 