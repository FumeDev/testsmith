import { setupTestsmith } from './auto/setup';
setupTestsmith();

export type { Page, StagehandPage, Observation, ProgressTrackerLike } from './types/page';

export { clickAction, doubleClickAction } from './actions/click';
export { hoverAction } from './actions/hover';
export { dragAction } from './actions/drag';
export { scrollAction } from './actions/scroll';
export { keypressAction } from './actions/keypress';
export { cookieAction } from './actions/cookie';
export { fillAction } from './actions/fill';
export { uploadFileAction } from './actions/upload';
export { extractAction, assertAction } from './actions/extract';
export { waitUntil } from './actions/waitUntil';
export { navigateAction, refreshAction } from './actions/navigation';

export { aiAct, aiExtract, aiAssert, expectAiAssert, setStagehandInstance } from './ai/aiAdapter';

export { safeClick } from './utils/safeClick';
export { safeDoubleClick } from './utils/safeDoubleClick'; 