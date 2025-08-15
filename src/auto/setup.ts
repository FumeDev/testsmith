import { setStagehandInstance } from '../ai/aiAdapter';

let initialized = false;

export function setupTestsmith(): void {
  if (initialized) return;
  initialized = true;

  // Try to set stagehand instance from a local import if present
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const maybeStagehand = require('stagehand');
    if (maybeStagehand) {
      setStagehandInstance(maybeStagehand);
    }
  } catch {
    // ignore if stagehand is not installed
  }

  // Also check globalThis.stagehand if provided by the test runtime
  // @ts-ignore
  if ((globalThis as any).stagehand) {
    // @ts-ignore
    setStagehandInstance((globalThis as any).stagehand);
  }
} 