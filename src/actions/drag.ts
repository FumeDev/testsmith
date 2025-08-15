import type { Page } from '../types/page';
import { aiAct } from '../ai/aiAdapter';

export async function dragAction(
  page: Page,
  description: string,
  sourceSelector?: string,
  dragOptions?: {
    targetSelector?: string;
    offset?: { x: number; y: number };
    variable?: string;
    defaultValue?: string;
  }
): Promise<boolean> {
  let actionSuccess = false;

  if (sourceSelector) {
    const shouldUseDrag = !dragOptions?.variable || !dragOptions?.defaultValue ||
      (dragOptions.variable === dragOptions.defaultValue);

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
    actionSuccess = await aiAct(page, description);
  }

  page.progressTracker.addStep(description, actionSuccess);
  return actionSuccess;
} 