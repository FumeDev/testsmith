import { Page as Page$1, Locator } from '@playwright/test';

interface Observation {
    selector?: string;
    description: string;
    [key: string]: unknown;
}
interface ProgressTrackerLike {
    addStep: (description: string, success?: boolean) => void;
}
type StagehandPage = Page$1 & {
    observe: (description: string) => Promise<Observation[]>;
    progressTracker: ProgressTrackerLike;
    locator: (selector: string) => Locator;
};
type Page = StagehandPage;

declare function clickAction(page: Page, description: string, selector?: string, options?: {
    variable?: string;
    defaultValue?: string;
}): Promise<boolean>;
declare function doubleClickAction(page: Page, description: string, selector?: string, options?: {
    variable?: string;
    defaultValue?: string;
}): Promise<boolean>;

declare function hoverAction(page: Page, description: string, selector?: string, options?: {
    variable?: string;
    defaultValue?: string;
}): Promise<boolean>;

declare function dragAction(page: Page, description: string, sourceSelector?: string, dragOptions?: {
    targetSelector?: string;
    offset?: {
        x: number;
        y: number;
    };
    variable?: string;
    defaultValue?: string;
}): Promise<boolean>;

declare function scrollAction(page: Page, description: string, selector?: string, scrollOptions?: {
    deltaX?: number;
    deltaY?: number;
    direction?: 'up' | 'down' | 'left' | 'right';
    amount?: 'small' | 'medium' | 'large' | number;
    scrollToSelector?: string;
    variable?: string;
    defaultValue?: string;
}): Promise<boolean>;

declare function keypressAction(page: Page, description: string, keys: string | string[], selector?: string, options?: {
    variable?: string;
    defaultValue?: string;
    focusFirst?: boolean;
}): Promise<boolean>;

interface CookieData {
    name: string;
    value: string;
    domain: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
}
declare function cookieAction(page: Page, cookieData: CookieData | CookieData[], description?: string, options?: {
    variable?: string;
    defaultValue?: string;
}): Promise<boolean>;

declare function fillAction(page: Page, description: string, value: string, selector?: string, options?: {
    variable?: string;
    defaultValue?: string;
}): Promise<boolean>;

declare function uploadFileAction(page: Page$1, description: string, filePaths: string | string[], selector?: string): Promise<boolean>;

declare function extractAction(page: Page, variableName: string, description: string): Promise<string>;
declare function assertAction(page: Page, description: string): Promise<void>;

declare function waitUntil(page: Page, condition: string): Promise<boolean>;

declare function navigateAction(page: Page, url: string, description?: string): Promise<void>;
declare function refreshAction(page: Page, description?: string): Promise<void>;

declare function setStagehandInstance(instance: any): void;
declare function aiAct(page: Page, description: string, timeout?: number): Promise<boolean>;
interface AiUtilityConfig {
    apiKey?: string;
    endpoint?: string;
    apiVersion?: string;
    deploymentName?: string;
    aiRequestTimeout?: number;
    screenshotDir?: string;
    skipAttachScreenshot?: boolean;
}
declare function aiExtract(page: Page, variableName: string, extractionGuide: string, config?: AiUtilityConfig, pageLoadTimeout?: number, retryCount?: number): Promise<string>;
interface AiAssertConfig {
    apiKey?: string;
    endpoint?: string;
    apiVersion?: string;
    deploymentName?: string;
    timeout?: number;
    screenshotDir?: string;
    skipAttachScreenshot?: boolean;
}
declare function aiAssert(page: Page, prompt: string, config?: AiAssertConfig, timeout?: number, retryCount?: number, timeoutRetryCount?: number): Promise<boolean>;
declare function expectAiAssert(page: Page, prompt: string, config?: AiAssertConfig): Promise<void>;

declare function safeClick(page: Page, selector: string): Promise<{
    success: boolean;
}>;

declare function safeDoubleClick(page: Page, selector: string): Promise<{
    success: boolean;
}>;

export { type Observation, type Page, type ProgressTrackerLike, type StagehandPage, aiAct, aiAssert, aiExtract, assertAction, clickAction, cookieAction, doubleClickAction, dragAction, expectAiAssert, extractAction, fillAction, hoverAction, keypressAction, navigateAction, refreshAction, safeClick, safeDoubleClick, scrollAction, setStagehandInstance, uploadFileAction, waitUntil };
