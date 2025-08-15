import type { Page as PlaywrightPage, Locator } from '@playwright/test';

export interface Observation {
  selector?: string;
  description: string;
  [key: string]: unknown;
}

export interface ProgressTrackerLike {
  addStep: (description: string, success?: boolean) => void;
}

export type StagehandPage = PlaywrightPage & {
  observe: (description: string) => Promise<Observation[]>;
  progressTracker: ProgressTrackerLike;
  locator: (selector: string) => Locator;
};

export type Page = StagehandPage; 