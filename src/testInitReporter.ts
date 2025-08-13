import { Reporter, TestCase, FullConfig } from '@playwright/test/reporter';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Reporter that handles test initialization and status tracking
 * Sends requests to /test/report-test-init endpoint to track test progress
 */
class TestInitReporter implements Reporter {
  private apiEndpoint: string;
  private groupId: string;
  private allTestFiles: string[] = [];

  constructor(options: { group_id?: string } = {}) {
    const apiHost = process.env.API_HOST || 'http://localhost:5000';
    this.apiEndpoint = `${apiHost}/test/report-test-init`;
    
    // Use provided option or fall back to environment variable
    this.groupId = options.group_id || process.env.GROUP_ID || '';
    
    console.log('TestInitReporter initialized:');
    console.log('API Endpoint:', this.apiEndpoint);
    console.log('Group ID (Option/Env):', this.groupId || 'not set');
  }

  /**
   * Called at the beginning of the test run
   * Collects all test files and sends initial "IN QUEUE" status
   */
  async onBegin(config: FullConfig) {
    if (!this.groupId) {
      console.warn('GROUP_ID environment variable not set. Test initialization tracking disabled.');
      return;
    }

    // Collect all test files from all projects
    this.allTestFiles = [];
    
    for (const project of config.projects) {
      // Get test files for this project
      const projectTestFiles = await this.getTestFilesForProject(project);
      this.allTestFiles.push(...projectTestFiles);
    }

    // Remove duplicates
    this.allTestFiles = [...new Set(this.allTestFiles)];

    console.log(`Found ${this.allTestFiles.length} test files to initialize`);
    
    // Send initial request to mark all tests as "IN QUEUE"
    await this.sendTestInitRequest(this.allTestFiles, 'IN QUEUE');
  }

  /**
   * Called when a test begins execution
   * Sends "RUNNING" status for the individual test
   */
  async onTestBegin(test: TestCase) {
    if (!this.groupId) {
      return;
    }

    const testFilePath = this.getCorrectTestFilePath(test);
    console.log(`Test starting: ${test.title} in file: ${testFilePath}`);
    
    // Send request to mark this specific test as "RUNNING"
    await this.sendTestInitRequest([testFilePath], 'RUNNING');
  }

  /**
   * Send request to the test initialization endpoint
   */
  private async sendTestInitRequest(testFiles: string[], status: string): Promise<void> {
    const payload = {
      group_id: this.groupId,
      test_files: testFiles,
      status: status
    };

    try {
      console.log(`Sending test init request: ${status} for ${testFiles.length} test(s)`);
      const response = await axios.post(this.apiEndpoint, payload);
      console.log(`Test init API response: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.error(`Failed to send test init request (${status}):`, error);
    }
  }

  /**
   * Get test files for a specific project
   */
  private async getTestFilesForProject(project: any): Promise<string[]> {
    const testFiles: string[] = [];
    
    // If project has a specific testDir, use it
    if (project.testDir) {
      const fs = require('fs');
      const path = require('path');
      
      try {
        // Get all .spec.ts and .spec.js files recursively
        const files = this.getAllTestFiles(project.testDir);
        testFiles.push(...files);
      } catch (error) {
        console.error(`Error scanning test directory ${project.testDir}:`, error);
      }
    }

    return testFiles;
  }

  /**
   * Recursively get all test files from a directory
   */
  private getAllTestFiles(dir: string): string[] {
    const fs = require('fs');
    const path = require('path');
    const testFiles: string[] = [];
    
    if (!fs.existsSync(dir)) {
      return testFiles;
    }

    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        testFiles.push(...this.getAllTestFiles(fullPath));
      } else if (item.endsWith('.spec.ts') || item.endsWith('.spec.js')) {
        // Add test files
        testFiles.push(fullPath);
      }
    }
    
    return testFiles;
  }

  /**
   * Safely obtain titlePath as an array whether it's a function or property
   */
  private getTitlePathArray(entity: any): string[] {
    try {
      const tp = entity?.titlePath;
      if (typeof tp === 'function') {
        return tp.call(entity) as string[];
      }
      if (Array.isArray(tp)) {
        return tp as string[];
      }
    } catch {}
    return [];
  }

  /**
   * Get the correct test file path by traversing the test's parent chain
   * This is needed because when using custom test wrappers, test.location.file
   * points to the wrapper file instead of the actual test file
   */
  private getCorrectTestFilePath(test: TestCase): string {
    // First, try to get the file path from the test's location
    let filePath = test.location.file;
    
    // If the file path points to stagehandFixture.ts, we need to find the real test file
    if (filePath.includes('stagehandFixture.ts')) {
      // Try to get the file path from titlePath (first element is usually the file path)
      const titlePathArr = this.getTitlePathArray(test);
      if (titlePathArr.length > 0) {
        const firstPath = titlePathArr[0];
        if (firstPath.endsWith('.spec.ts') || firstPath.endsWith('.spec.js')) {
          filePath = firstPath;
          return filePath;
        }
      }
      
      // Traverse up the parent chain to find the root suite (which should be the file)
      let current: any = test.parent;
      while (current) {
        // Check if this suite has a location with a file path
        if (current.location?.file && !current.location.file.includes('stagehandFixture.ts')) {
          filePath = current.location.file;
          break;
        }
        
        // If the suite title looks like a file path, use it
        if (current.title && (current.title.endsWith('.spec.ts') || current.title.endsWith('.spec.js'))) {
          filePath = current.title;
          break;
        }
        
        current = current.parent;
      }
    }
    
    return filePath;
  }
}

export default TestInitReporter; 