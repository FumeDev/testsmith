export type AnyFn = (...args: any[]) => any;

let aiActImpl: AnyFn = async () => false;
let aiExtractImpl: AnyFn = async () => '';
let aiAssertImpl: AnyFn = async () => false;
let expectAiAssertImpl: AnyFn = async () => {};

export function getAiAct(): AnyFn {
  return aiActImpl;
}

export function getAiExtract(): AnyFn {
  return aiExtractImpl;
}

export function getAiAssert(): AnyFn {
  return aiAssertImpl;
}

export function getExpectAiAssert(): AnyFn {
  return expectAiAssertImpl;
}

// Optional: internal configuration hook (not exported via index)
export function __configureAI(adapters: {
  aiAct?: AnyFn;
  aiExtract?: AnyFn;
  aiAssert?: AnyFn;
  expectAiAssert?: AnyFn;
}) {
  if (adapters.aiAct) aiActImpl = adapters.aiAct;
  if (adapters.aiExtract) aiExtractImpl = adapters.aiExtract;
  if (adapters.aiAssert) aiAssertImpl = adapters.aiAssert;
  if (adapters.expectAiAssert) expectAiAssertImpl = adapters.expectAiAssert;
} 