import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Class for tracking test progress and storing step descriptions
 */
export class TestProgressTracker {
  private steps: Array<{description: string, timestamp: number, videoTimestamp?: number}> = [];
  private testId: string;
  private testCaseGuide: string = '';
  private loginNotes: string = '';
  private filePath: string = '';
  private aiAssertions: Array<{condition: string, screenshot: string, result?: boolean}> = [];
  private testStartTime: number = 0;
  private videoStartTime: number = 0;

  constructor(testId: string = '', filePath: string = '') {
    this.testId = testId || `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.filePath = filePath;
    this.testStartTime = Date.now();
  }

  /**
   * Set the file path for the test
   * @param filePath - The path to the test file
   */
  public setFilePath(filePath: string): void {
    this.filePath = filePath;
  }

  /**
   * Get the file path for the test
   * @returns The test file path
   */
  public getFilePath(): string {
    return this.filePath;
  }

  /**
   * Set the video start time (when recording begins)
   * @param startTime - The timestamp when video recording started
   */
  public setVideoStartTime(startTime: number): void {
    this.videoStartTime = startTime;
  }

  /**
   * Get the video start time
   * @returns The timestamp when video recording started
   */
  public getVideoStartTime(): number {
    return this.videoStartTime;
  }

  /**
   * Get the test start time
   * @returns The timestamp when test started
   */
  public getTestStartTime(): number {
    return this.testStartTime;
  }

  /**
   * Add a step description to the progress tracker
   * @param description - The description of the completed step
   */
  public addStep(description: string, success: boolean = true): void {
    if (!success) {
      description = `${description}* (There has been some complications executing this step. Keep in mind that this step was probably not executed properly.)`;
    }
    this.steps.push({
      description,
      timestamp: Date.now(),
      videoTimestamp: this.videoStartTime ? Date.now() - this.videoStartTime : undefined
    });
  }

  /**
   * Add an AI assertion to the tracker
   * @param condition - The condition/prompt used in the assertion
   * @param screenshot - Base64-encoded screenshot
   * @param result - The result of the assertion (true/false)
   */
  public addAiAssertion(condition: string, screenshot: string, result?: boolean): void {
    this.aiAssertions.push({
      condition,
      screenshot,
      result
    });
    console.log(`[${this.testId}] Added AI assertion: "${condition}" with result: ${result}`);
  }

  /**
   * Get all AI assertions that have been recorded
   * @returns Array of AI assertion data
   */
  public getAiAssertions(): Array<{condition: string, screenshot: string, result?: boolean}> {
    return [...this.aiAssertions];
  }

  /**
   * Set the test case guide
   * @param guide - The guide text for the test case
   */
  public setTestCaseGuide(guide: string): void {
    this.testCaseGuide = guide;
    console.log(`[${this.testId}] Set test case guide: "${guide}"`);
  }

  /**
   * Get the test case guide
   * @returns The test case guide
   */
  public async getTestCaseGuide(): Promise<string> {
    if (!this.testCaseGuide && this.filePath) {
      const guide = await this.fetchTestGuide();
      if (guide) {
        this.testCaseGuide = guide;
        console.log(`[${this.testId}] Fetched test case guide: "${this.testCaseGuide}"`);
      }
    }
    return this.testCaseGuide;
  }

  /**
   * Set the login notes
   * @param notes - The login notes text
   */
  public setLoginNotes(notes: string): void {
    this.loginNotes = notes;
    console.log(`[${this.testId}] Set login notes: "${notes}"`);
  }

  /**
   * Get the login notes
   * @returns The login notes
   */
  public getLoginNotes(): string {
    return this.loginNotes;
  }

  /**
   * Fetch test guide from the API using stored file path and environment API key
   * @returns Promise that resolves to the test guide string or empty string if any errors occur
   */
  private async fetchTestGuide(): Promise<string> {
    console.log(`[${this.testId}] fetchTestGuide called with filePath: "${this.filePath}"`);
    
    if (!this.filePath || !process.env.FUME_API_KEY) {
      console.log(`[${this.testId}] Missing filePath or FUME_API_KEY - filePath: "${this.filePath}", API_KEY exists: ${!!process.env.FUME_API_KEY}`);
      return '';
    }

    try {
      const apiHost = process.env.API_HOST || 'https://api.fumedev.com';
      const requestUrl = `${apiHost}/test/get_test_guide`;
      console.log(`[${this.testId}] Making API request to: ${requestUrl} with file_path: "${this.filePath}"`);
      
      const response = await axios.get(requestUrl, {
        headers: {
          'Authorization': process.env.FUME_API_KEY
        },
        params: {
          file_path: this.filePath
        }
      });
      
      if (response.data?.test_guide) {
        this.setTestCaseGuide(response.data.test_guide);
        
        // Handle login notes if available
        if (response.data?.login_notes) {
          this.setLoginNotes(response.data.login_notes);
          console.log(`[${this.testId}] Successfully fetched login notes`);
        }
        
        console.log(`[${this.testId}] Successfully fetched test guide`);
        return response.data.test_guide;
      }
      
      console.log(`[${this.testId}] No test guide in response`);
      return '';
    } catch (error) {
      console.log(`[${this.testId}] Error fetching test guide:`, error instanceof Error ? error.message : String(error));
      return '';
    }
  }

  /**
   * Get all steps as a formatted string
   * @param getGuide - Whether to include the test guide and login notes in output (default: true)
   * @returns The test progress as a string with numbered steps
   */
  public getProgressString(getGuide: boolean = true): string {
    if (this.steps.length === 0) {
      return "No steps completed yet.";
    }
    
    let output = '';
    
    // Add test case guide if set
    if (this.testCaseGuide && getGuide) {
      output += `Test Case Guide:\n${this.testCaseGuide}\n\n`;
      
      // Add login notes if available
      if (this.loginNotes && getGuide) {
        output += `Login Notes:\n${this.loginNotes}\n\n`;
      }
      
      output += `Test Steps:\n`;
    }
    
    output += this.steps.map((step, index) => 
      `Step ${index + 1}: ${step.description} (Executed at: ${new Date(step.timestamp).toLocaleTimeString()})`
    ).join('\n');
    
    return output;
  }

  /**
   * Get the test ID
   * @returns The test ID
   */
  public getTestId(): string {
    return this.testId;
  }

  /**
   * Get the number of completed steps
   * @returns The number of steps
   */
  public getStepCount(): number {
    return this.steps.length;
  }

  /**
   * Get all steps as an array
   * @returns Array of step descriptions
   */
  public getSteps(): Array<{description: string, timestamp: number, videoTimestamp?: number}> {
    return [...this.steps];
  }

  /**
   * Get steps with video timestamps in a readable format
   * @returns Array of steps with human-readable video timestamps
   */
  public getStepsWithVideoTimestamps(): Array<{description: string, videoTimestamp: string}> {
    return this.steps.map(step => ({
      description: step.description,
      videoTimestamp: step.videoTimestamp 
        ? this.formatDuration(step.videoTimestamp)
        : 'N/A'
    }));
  }

  /**
   * Get progress string with video timestamps
   * @returns The test progress as a string with video timestamps
   */
  public getProgressStringWithVideoTimestamps(): string {
    if (this.steps.length === 0) {
      return "No steps completed yet.";
    }
    
    let output = '';
    
    // Add test case guide if set
    if (this.testCaseGuide) {
      output += `Test Case Guide:\n${this.testCaseGuide}\n\n`;
      
      // Add login notes if available
      if (this.loginNotes) {
        output += `Login Notes:\n${this.loginNotes}\n\n`;
      }
      
      output += `Test Steps (with Video Timestamps):\n`;
    }
    
    output += this.steps.map((step, index) => {
      const videoTime = step.videoTimestamp 
        ? ` [Video: ${this.formatDuration(step.videoTimestamp)}]`
        : ' [Video: N/A]';
      
      return `Step ${index + 1}: ${step.description}${videoTime} (Executed at: ${new Date(step.timestamp).toLocaleTimeString()})`;
    }).join('\n');
    
    return output;
  }

  /**
   * Format milliseconds into MM:SS format
   * @param ms - Milliseconds to format
   * @returns Formatted time string
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Export steps as JSON with video timestamps
   * @returns JSON string of steps with timing information
   */
  public exportStepsAsJson(): string {
    return JSON.stringify({
      testId: this.testId,
      testStartTime: this.testStartTime,
      videoStartTime: this.videoStartTime,
      steps: this.steps.map(step => ({
        description: step.description,
        timestamp: step.timestamp,
        videoTimestamp: step.videoTimestamp,
        videoTimestampFormatted: step.videoTimestamp ? this.formatDuration(step.videoTimestamp) : null
      }))
    }, null, 2);
  }
}

// Export the global map for use by reporters
export const testProgressTrackers: Map<string, TestProgressTracker> = new Map(); 