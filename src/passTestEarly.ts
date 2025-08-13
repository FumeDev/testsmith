/**
 * Special exception class used to signal that a test should end early with a "passed" status.
 * This is thrown by the agent() function when it successfully completes a task and wants
 * to prevent any remaining test steps from executing.
 */
export class PassTestEarly extends Error {
  constructor(message: string = 'Test completed successfully via agent') {
    super(message);
    this.name = 'PassTestEarly';
  }
}

/**
 * Utility function to end a test early with a passed status.
 * This throws a special exception that will be caught by the test fixture wrapper.
 * 
 * @param message Optional message to include in the test annotations
 */
export function passTestEarly(message?: string): never {
  throw new PassTestEarly(message);
} 