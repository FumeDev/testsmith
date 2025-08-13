import { Reporter, TestCase, TestResult, TestStatus, FullConfig, FullResult } from '@playwright/test/reporter';
import axios, { AxiosRequestConfig } from 'axios';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as http from 'http';
import * as https from 'https';
import { testProgressTrackers } from './TestProgressTracker';

// Load environment variables from .env file
dotenv.config();

interface TestResultWithArtifacts extends TestResult {
  trace?: { path: string };
  video?: { path: string };
}

interface ArtifactUpload {
  path: string;
  type: 'trace' | 'screenshot' | 'video';
  testTitle: string;
}

// Define interface for test result artifacts in the payload
interface TestArtifacts {
  trace?: { url: string };
  screenshots: { url: string }[];
  video?: { url: string };
}

// Define interface for test step with timing information
interface TestStep {
  description: string;
  timestamp: number;
  videoTimestamp?: number;
  videoTimestampFormatted?: string;
}

// Define interface for test steps data
interface TestStepsData {
  testId: string;
  testStartTime: number;
  videoStartTime: number;
  steps: TestStep[];
}

/**
 * Custom reporter that sends test results to an API endpoint after test runs
 */
class ApiReporter implements Reporter {
  private results: {
    title: string;
    status: TestStatus;
    duration: number;
    error?: string;
    projectName: string;
    file: string;
    artifacts: TestArtifacts;
    annotations: { type: string; description?: string }[];
    steps?: TestStepsData;
  }[] = [];
  
  private apiEndpoint: string;
  private bunnyStorageZone: string;
  private bunnyAccessKey: string;
  private bunnyStorageHost: string;
  private uploadQueue: ArtifactUpload[] = [];
  private uploadResults: Map<string, string> = new Map();
  private testArtifactMapping: Map<string, { trace?: string; video?: string; screenshots: string[] }> = new Map();
  private groupId: string;
  private apiReportingEnabled: boolean;

  constructor(options: { apiEndpoint?: string; group_id?: string } = {}) {
    const apiHost = process.env.API_HOST;
    
    // Check if API reporting should be enabled
    this.apiReportingEnabled = !!apiHost;
    
    if (this.apiReportingEnabled) {
      this.apiEndpoint = `${apiHost}/test/report-results`;
      console.log('API reporting enabled with endpoint:', this.apiEndpoint);
    } else {
      this.apiEndpoint = '';
      console.log('API_HOST not set - API reporting disabled');
    }
    
    // Use provided option or fall back to environment variable
    this.groupId = options.group_id || process.env.GROUP_ID || '';
    
    // Debug logging for all relevant environment variables
    console.log('Environment Variables:');
    console.log('BUNNY_STORAGE_ZONE:', process.env.BUNNY_STORAGE_ZONE);
    console.log('BUNNY_ACCESS_KEY:', process.env.BUNNY_ACCESS_KEY ? '****' + process.env.BUNNY_ACCESS_KEY.slice(-4) : 'not set');
    console.log('BUNNY_STORAGE_HOST:', process.env.BUNNY_STORAGE_HOST);
    console.log('BUNNY_REGION:', process.env.BUNNY_REGION);
    console.log('GROUP_ID (Option/Env):', this.groupId || 'not set');
    
    this.bunnyStorageZone = process.env.BUNNY_STORAGE_ZONE || '';
    this.bunnyAccessKey = process.env.BUNNY_ACCESS_KEY || '';
    
    // Handle regional endpoints
    const region = process.env.BUNNY_REGION || '';
    this.bunnyStorageHost = region 
      ? `${region}.storage.bunnycdn.com`
      : process.env.BUNNY_STORAGE_HOST || 'storage.bunnycdn.com';
    
    // Debug logging for final configuration
    console.log('\nFinal Configuration:');
    console.log('API Reporting Enabled:', this.apiReportingEnabled);
    console.log('Storage Zone:', this.bunnyStorageZone);
    console.log('Access Key:', this.bunnyAccessKey ? '****' + this.bunnyAccessKey.slice(-4) : 'not set');
    console.log('Storage Host:', this.bunnyStorageHost);
    console.log('Group ID:', this.groupId || 'not set');
    
    if (!this.bunnyStorageZone || !this.bunnyAccessKey) {
      console.warn('BunnyCDN credentials not found. Artifacts will not be uploaded.');
    }
  }

  private async uploadToBunny(filePath: string, fileName: string): Promise<string | null> {
    if (!this.bunnyStorageZone || !this.bunnyAccessKey) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const hash = crypto.createHash('md5').update(fileName + timestamp).digest('hex').slice(0, 8);

    let sanitizedFileName = path.basename(fileName).replace(/[^a-zA-Z0-9.-]/g, '-');
    // Ensure the sanitized filename has an extension; if not, take it from the original file path
    if (!sanitizedFileName.includes('.')) {
      const ext = path.extname(filePath);
      sanitizedFileName += ext;
    }
    const uniqueFileName = `${timestamp}-${hash}-${sanitizedFileName}`;

    const encodedFileName = encodeURIComponent(uniqueFileName);
    const uploadUrl = `https://${this.bunnyStorageHost}/${this.bunnyStorageZone}/${encodedFileName}`;
    const contentType = this.getContentType(filePath);

    const attemptUpload = async (extraConfig: Partial<AxiosRequestConfig> = {}) => {
      const stream = createReadStream(filePath);
      await axios.put(uploadUrl, stream, {
        headers: {
          'AccessKey': this.bunnyAccessKey.trim(),
          'Content-Type': contentType
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        proxy: false,
        ...extraConfig
      });
    };

    try {
      console.log(`Uploading to BunnyCDN: ${uploadUrl}`);
      console.log(`File type: ${contentType}`);
      await attemptUpload();
      const cdnUrl = `https://${this.bunnyStorageZone}.b-cdn.net/${encodedFileName}`;
      console.log(`File uploaded successfully. CDN URL: ${cdnUrl}`);
      return cdnUrl;
    } catch (error: any) {
      const message = error?.message || '';
      if (message.includes('protocol mismatch') || message.includes('socks5:') || message.includes('EPROTO')) {
        console.warn('Detected proxy/protocol issue. Retrying with explicit HTTP agents...');
        try {
          const httpAgent = new http.Agent({ keepAlive: true });
          const httpsAgent = new https.Agent({ keepAlive: true });
          await attemptUpload({ httpAgent, httpsAgent });
          const cdnUrl = `https://${this.bunnyStorageZone}.b-cdn.net/${encodedFileName}`;
          console.log(`File uploaded successfully after retry. CDN URL: ${cdnUrl}`);
          return cdnUrl;
        } catch (retryError) {
          console.error('Retry with explicit agents failed:', retryError);
        }
      }

      if (axios.isAxiosError(error)) {
        console.error(`Failed to upload file ${fileName} to BunnyCDN:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          message: error.message,
          code: error.code
        });
      } else {
        console.error(`Failed to upload file ${fileName} to BunnyCDN:`, error);
      }
      return null;
    }
  }

  private async processUploadQueue(): Promise<void> {
    console.log(`Starting parallel upload of ${this.uploadQueue.length} artifacts to BunnyCDN...`);
    
    // Process uploads one by one to avoid overloading the API
    for (const artifact of this.uploadQueue) {
      const fileName = `${artifact.type}-${artifact.testTitle}`;
      console.log(`Processing upload for ${fileName}`);
      
      // Determine the file extension from the artifact path
      const fileExt = path.extname(artifact.path);
      
      // Adjust the fileName to include the extension
      const fileNameWithExt = fileName + (fileExt || this.getDefaultExtension(artifact.type));
      
      const url = await this.uploadToBunny(artifact.path, fileNameWithExt);
      if (url) {
        this.uploadResults.set(artifact.path, url);
      }
    }
    
    console.log('Finished uploading all artifacts to BunnyCDN');
    
    // Clear the queue after processing
    this.uploadQueue = [];
  }

  private getDefaultExtension(artifactType: string): string {
    switch (artifactType) {
      case 'screenshot':
        return '.png';
      case 'video':
        return '.webm';
      case 'trace':
        return '.zip';
      default:
        return '.bin';
    }
  }
  
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webm':
        return 'video/webm';
      case '.mp4':
        return 'video/mp4';
      case '.zip':
        return 'application/zip';
      default:
        return 'application/octet-stream';
    }
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
   * Format milliseconds into MM:SS format for video timestamps
   * @param ms - Milliseconds to format
   * @returns Formatted time string
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  onBegin(config: FullConfig) {
    console.log('Starting test run with API reporting enabled');
    this.results = [];
    this.uploadQueue = [];
    this.uploadResults = new Map();
    this.testArtifactMapping = new Map();
  }

  async onTestEnd(test: TestCase, result: TestResult) {
    const testResult = result as TestResultWithArtifacts;
    
    console.log(`Debug - TestResult properties for "${test.title}":`);
    console.log(`  trace?.path: ${testResult.trace?.path || 'not set'}`);
    console.log(`  video?.path: ${testResult.video?.path || 'not set'}`);
    console.log(`  attachments count: ${testResult.attachments?.length || 0}`);
    console.log(`  annotations count: ${result.annotations?.length || 0}`);
    if (result.annotations && result.annotations.length > 0) {
      result.annotations.forEach((annotation, index) => {
        console.log(`    annotation[${index}]: ${annotation.type} - ${annotation.description || 'no description'}`);
      });
    }
    if (testResult.attachments && testResult.attachments.length > 0) {
      testResult.attachments.forEach((attachment, index) => {
        console.log(`    attachment[${index}]: ${attachment.name || 'unnamed'} - ${attachment.contentType} - ${attachment.path || 'no path'}`);
      });
    }

    // Initialize artifact tracking for this test
    if (!this.testArtifactMapping.has(test.title)) {
      this.testArtifactMapping.set(test.title, { screenshots: [] });
    }
    const testArtifacts = this.testArtifactMapping.get(test.title)!;

    // Process attachments from the TestResult object (this is the reliable source)
    if (testResult.attachments) {
      for (const attachment of testResult.attachments) {
        if (!attachment.path || !fs.existsSync(attachment.path)) {
          continue;
        }

        // Handle video attachments
        if (attachment.contentType?.includes('video/') || attachment.name === 'video') {
          console.log(`Queueing video attachment for upload: ${attachment.path}`);
          this.uploadQueue.push({
            path: attachment.path,
            type: 'video',
            testTitle: test.title
          });
          testArtifacts.video = attachment.path;
        }
        
        // Handle trace attachments
        else if (attachment.contentType?.includes('application/zip') || attachment.name === 'trace') {
          console.log(`Queueing trace attachment for upload: ${attachment.path}`);
          this.uploadQueue.push({
            path: attachment.path,
            type: 'trace',
            testTitle: test.title
          });
          testArtifacts.trace = attachment.path;
        }
        
        // Handle screenshot attachments
        else if (attachment.contentType?.includes('image/')) {
          console.log(`Queueing screenshot attachment for upload: ${attachment.path}`);
          this.uploadQueue.push({
            path: attachment.path,
            type: 'screenshot',
            testTitle: test.title
          });
          testArtifacts.screenshots.push(attachment.path);
        }
      }
    }

    // Fallback: if trace/video paths are directly available on the testResult object
    if (testResult.trace?.path && fs.existsSync(testResult.trace.path)) {
      console.log(`Queueing trace for upload: ${testResult.trace.path}`);
      this.uploadQueue.push({
        path: testResult.trace.path,
        type: 'trace',
        testTitle: test.title
      });
      testArtifacts.trace = testResult.trace.path;
    }

    if (testResult.video?.path && fs.existsSync(testResult.video.path)) {
      console.log(`Queueing video for upload: ${testResult.video.path}`);
      this.uploadQueue.push({
        path: testResult.video.path,
        type: 'video',
        testTitle: test.title
      });
      testArtifacts.video = testResult.video.path;
    }

    // Collect test steps data from TestProgressTracker or from JSON file
    let stepsData: TestStepsData | undefined;
    console.log(`Looking for TestProgressTracker with test title: "${test.title}"`);
    console.log(`Available trackers in testProgressTrackers:`, Array.from(testProgressTrackers.keys()));
    
    const progressTracker = testProgressTrackers.get(test.title);
    if (progressTracker) {
      const steps = progressTracker.getSteps();
      console.log(`Found TestProgressTracker with ${steps.length} steps for "${test.title}"`);
      stepsData = {
        testId: progressTracker.getTestId(),
        testStartTime: progressTracker.getTestStartTime(),
        videoStartTime: progressTracker.getVideoStartTime(),
        steps: steps.map(step => ({
          description: step.description,
          timestamp: step.timestamp,
          videoTimestamp: step.videoTimestamp,
          videoTimestampFormatted: step.videoTimestamp ? this.formatDuration(step.videoTimestamp) : undefined
        }))
      };
      console.log(`Collected ${steps.length} test steps for "${test.title}"`);
    } else {
      console.log(`No TestProgressTracker found for "${test.title}" - trying to read from JSON file`);
      
      // Try to find test-steps-with-timestamps.json attachment
      const stepsAttachment = testResult.attachments?.find(att => 
        att.name === 'test-steps-with-timestamps' && att.path && fs.existsSync(att.path)
      );
      
      if (stepsAttachment?.path) {
        try {
          console.log(`Found test-steps JSON file at: ${stepsAttachment.path}`);
          const stepsJsonContent = fs.readFileSync(stepsAttachment.path, 'utf8');
          const parsedStepsData = JSON.parse(stepsJsonContent);
          
          // Convert to our expected format
          stepsData = {
            testId: parsedStepsData.testId || test.title,
            testStartTime: parsedStepsData.testStartTime || 0,
            videoStartTime: parsedStepsData.videoStartTime || 0,
            steps: parsedStepsData.steps?.map((step: any) => ({
              description: step.description,
              timestamp: step.timestamp,
              videoTimestamp: step.videoTimestamp,
              videoTimestampFormatted: step.videoTimestampFormatted
            })) || []
          };
          
          console.log(`Successfully loaded ${stepsData.steps.length} steps from JSON file for "${test.title}"`);
          
          // Clean up the JSON file after successfully reading it
          try {
            fs.unlinkSync(stepsAttachment.path);
            console.log(`🧹 Cleaned up test-steps JSON file: ${stepsAttachment.path}`);
          } catch (cleanupError) {
            console.warn(`Warning: Could not clean up test-steps JSON file: ${cleanupError}`);
          }
        } catch (error) {
          console.error(`Error reading test steps JSON file:`, error);
        }
      } else {
        console.log(`No test-steps JSON file found in attachments for "${test.title}"`);
        console.log(`Available tracker keys:`, Array.from(testProgressTrackers.keys()));
      }
    }

    // Store test result without artifacts for now, but include annotations and steps
    const testInfo = {
      title: test.title,
      status: testResult.status,
      duration: testResult.duration,
      error: testResult.error?.message,
      projectName: test.parent.project()?.name || 'unknown',
      file: this.getCorrectTestFilePath(test),
      artifacts: {
        trace: undefined,
        screenshots: [] as { url: string }[],
        video: undefined
      },
      annotations: result.annotations || [],
      steps: stepsData
    };
    
    this.results.push(testInfo);
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
          console.log(`Got file path from titlePath: ${filePath}`);
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
        
        // Check if this is a file suite (root suite typically has the file path)
        if (current._type === 'file' && current._title) {
          // The title of a file suite is typically the file path
          filePath = current._title;
          break;
        }
        
        // If the suite title looks like a file path, use it
        if (current.title && (current.title.endsWith('.spec.ts') || current.title.endsWith('.spec.js'))) {
          filePath = current.title;
          break;
        }
        
        // Check if parent has titlePath that could contain the file
        const parentTitlePath = this.getTitlePathArray(current);
        if (parentTitlePath.length > 0) {
          const parentFirstPath = parentTitlePath[0];
          if (parentFirstPath.endsWith('.spec.ts') || parentFirstPath.endsWith('.spec.js')) {
            filePath = parentFirstPath;
            break;
          }
        }
        
        current = current.parent;
      }
      
      console.log(`Corrected file path from ${test.location.file} to ${filePath}`);
    }
    
    return filePath;
  }
  
  /**
   * Find files with specific extensions in a directory
   */
  private findFiles(directory: string, extensions: string[]): string[] {
    if (!fs.existsSync(directory)) {
      return [];
    }
    
    try {
      const files = fs.readdirSync(directory);
      return files.filter(file => 
        extensions.some(ext => file.toLowerCase().endsWith(ext.toLowerCase()))
      );
    } catch (error) {
      console.error(`Error searching directory ${directory}:`, error);
      return [];
    }
  }

  async onEnd(result: FullResult) {
    // If API reporting is disabled, don't do anything
    if (!this.apiReportingEnabled) {
      console.log('API reporting is disabled. Skipping all artifact uploads and API reporting.');
      return;
    }

    // Process all queued uploads in parallel
    await this.processUploadQueue();

    // Update test results with uploaded artifact URLs
    for (const testResult of this.results) {
      console.log(`\nLooking for artifacts for test: "${testResult.title}"`);
      
      const testArtifacts = {
        trace: undefined as { url: string } | undefined,
        screenshots: [] as { url: string }[],
        video: undefined as { url: string } | undefined,
      };

      // Get the artifact paths for this test
      const artifactPaths = this.testArtifactMapping.get(testResult.title);
      if (artifactPaths) {
        // Find trace URL
        if (artifactPaths.trace && this.uploadResults.has(artifactPaths.trace)) {
          const url = this.uploadResults.get(artifactPaths.trace)!;
          testArtifacts.trace = { url };
          console.log(`✅ Added trace artifact to test result: ${url}`);
        }

        // Find video URL
        if (artifactPaths.video && this.uploadResults.has(artifactPaths.video)) {
          const url = this.uploadResults.get(artifactPaths.video)!;
          testArtifacts.video = { url };
          console.log(`✅ Added video artifact to test result: ${url}`);
        }

        // Find screenshot URLs
        for (const screenshotPath of artifactPaths.screenshots) {
          if (this.uploadResults.has(screenshotPath)) {
            const url = this.uploadResults.get(screenshotPath)!;
            testArtifacts.screenshots.push({ url });
            console.log(`✅ Added screenshot artifact to test result: ${url}`);
          }
        }
      }

      testResult.artifacts = testArtifacts;
    }

    // Handle flaky tests: identify tests that have both passed and failed results
    const testResultsMap = new Map<string, typeof this.results>();
    const flakyTests = new Set<string>();
    const filteredResults: typeof this.results = [];
    
    // Group test results by title to identify duplicates/retries
    for (const testResult of this.results) {
      // Use a composite key of file path + title to avoid merging distinct tests that share the same title
      const testKey = `${testResult.file}#${testResult.title}`;
      if (!testResultsMap.has(testKey)) {
        testResultsMap.set(testKey, []);
      }
      testResultsMap.get(testKey)!.push(testResult);
    }
    
    // Process each test group to identify flaky tests
    for (const [testTitle, testResults] of testResultsMap.entries()) {
      const hasPassedResult = testResults.some(r => r.status === 'passed');
      const hasFailedResult = testResults.some(r => r.status === 'failed');
      
      if (hasPassedResult && hasFailedResult) {
        // This is a flaky test - only keep the passing results
        flakyTests.add(testTitle);
        const passingResults = testResults.filter(r => r.status === 'passed');
        if (passingResults.length > 0) {
          // Take the latest passing result
          const latestPassing = passingResults[passingResults.length - 1];
          filteredResults.push({
            ...latestPassing,
            title: `${latestPassing.title}`, // Keep original title
            isFlaky: true
          } as any);
        }
        console.log(`🔄 Identified flaky test in project: ${testTitle} - keeping only passing result`);
      } else {
        // Not a flaky test - keep all results (or the latest if multiple of same status)
        const latestResult = testResults[testResults.length - 1];
        filteredResults.push({
          ...latestResult,
          isFlaky: false
        } as any);
      }
    }
    
    if (flakyTests.size > 0) {
      console.log(`🔍 Found ${flakyTests.size} flaky test(s) in this project - filtered to passing results only`);
    }

    // Log the artifacts, annotations, and steps being sent in the payload
    console.log('Test artifacts, annotations, and steps summary:');
    filteredResults.forEach(result => {
      console.log(`Test: ${result.title}`);
      console.log(`  Status: ${result.status}${(result as any).isFlaky ? ' (flaky - showing pass)' : ''}`);
      console.log(`  Trace: ${result.artifacts.trace?.url || 'none'}`);
      console.log(`  Screenshots: ${result.artifacts.screenshots.length}`);
      console.log(`  Video: ${result.artifacts.video?.url || 'none'}`);
      console.log(`  Annotations: ${result.annotations.length}`);
      console.log(`  Steps: ${result.steps?.steps.length || 0}`);
      
      if (result.annotations.length > 0) {
        result.annotations.forEach((annotation, index) => {
          console.log(`    [${index}] ${annotation.type}: ${annotation.description || 'no description'}`);
        });
      }
      
      if (result.steps && result.steps.steps.length > 0) {
        console.log(`  Test Steps with Video Timestamps:`);
        result.steps.steps.forEach((step, index) => {
          const videoTime = step.videoTimestampFormatted ? ` [${step.videoTimestampFormatted}]` : ' [N/A]';
          console.log(`    [${index + 1}]${videoTime} ${step.description}`);
        });
      }
    });

    // Calculate adjusted counts based on filtered results
    const adjustedFailedCount = filteredResults.filter(r => r.status === 'failed').length;
    const adjustedPassedCount = filteredResults.filter(r => r.status === 'passed').length;
    const adjustedSkippedCount = filteredResults.filter(r => r.status === 'skipped').length;

    const payload = {
      timestamp: new Date().toISOString(),
      baseUrl: process.env.BASE_URL,
      studioId: process.env.STUDIO_ID,
      groupId: this.groupId,
      status: adjustedFailedCount > 0 ? 'failed' : result.status,
      duration: result.duration,
      testsCount: filteredResults.length,
      failedCount: adjustedFailedCount,
      passedCount: adjustedPassedCount,
      skippedCount: adjustedSkippedCount,
      tests: filteredResults,
      failedTests: filteredResults.filter(r => r.status === 'failed'),
      flakyTestsCount: flakyTests.size,
      flakyTests: Array.from(flakyTests)
    };

    // Check if running in parallel mode
    const isParallelMode = process.env.PARALLEL_MODE === 'true';
    
    if (isParallelMode) {
      // In parallel mode, save results to file instead of making API call
      const projectName = process.env.PLAYWRIGHT_PROJECT_NAME || 'unknown-project';
      const resultsDir = './api-results';
      
      // Ensure results directory exists
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      
      const resultsFile = path.join(resultsDir, `${projectName}-api-data.json`);
      
      try {
        fs.writeFileSync(resultsFile, JSON.stringify(payload, null, 2));
        console.log(`📁 Parallel mode: API data saved to ${resultsFile}`);
        if (flakyTests.size > 0) {
          console.log(`🔄 Flaky test handling applied: ${flakyTests.size} test(s) filtered to passing results`);
        }
        console.log(`🔄 API call will be made after all projects complete`);
      } catch (error) {
        console.error(`❌ Failed to save API data to file:`, error);
      }
    } else {
      // Normal mode: make API call directly
      if (this.apiReportingEnabled) {
        try {
          console.log(`Sending test results to API: ${this.apiEndpoint}`);
          if (flakyTests.size > 0) {
            console.log(`🔄 Including flaky test handling: ${flakyTests.size} test(s) filtered to passing results`);
          }
          const response = await axios.post(this.apiEndpoint, payload);
          console.log(`API Response: ${response.status} ${response.statusText}`);
        } catch (error) {
          console.error('Failed to send test results to API:', error);
        }
      } else {
        console.log('API reporting is disabled. Skipping API call.');
      }
    }
  }

  /**
   * Detect artifact type based on file extension or path
   */
  private detectArtifactType(path: string): 'trace' | 'screenshot' | 'video' | null {
    const ext = path.toLowerCase();
    
    if (ext.endsWith('.zip')) {
      return 'trace';
    }
    
    if (ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || path.includes('aiAssert')) {
      return 'screenshot';
    }
    
    if (ext.endsWith('.webm') || ext.endsWith('.mp4')) {
      return 'video';
    }
    
    return null;
  }
  
  /**
   * Check if a path matches a test title, handling sanitized names
   */
  private matchesTestTitle(path: string, title: string): boolean {
    // Check for aiAssert screenshot pattern which is commonly used for screenshots
    if (path.includes('aiAssert') && path.includes('.png')) {
      console.log(`✅ Found aiAssert screenshot match for "${title}"`);
      return true;
    }
    
    // Direct match
    if (path.includes(title)) {
      return true;
    }
    
    // For directory match pattern like "action-details-page-exampl-cb4d7-om-and-check-the-search-bar-chromium"
    if (path.includes('action-details-page') && path.includes('check-the-search-bar')) {
      console.log(`✅ Found directory match for "${title}"`);
      return true;
    }
    
    // Match sanitized version of the title (spaces/special chars replaced with dashes)
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
    if (path.toLowerCase().includes(sanitizedTitle)) {
      return true;
    }
    
    // Match with spaces replaced by hyphens
    const spaceReplaced = title.replace(/\s+/g, '-').toLowerCase();
    if (path.toLowerCase().includes(spaceReplaced)) {
      return true;
    }
    
    // Match key portions of the test name (often the most distinctive part is after "check")
    if (title.includes('check') && path.toLowerCase().includes('check')) {
      const checkPart = title.split('check')[1].trim().replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
      if (path.toLowerCase().includes(checkPart)) {
        console.log(`✅ Found partial match using "check" portion: "${checkPart}"`);
        return true;
      }
    }
    
    // Match any 3 consecutive words from the test title
    const words = title.split(/\s+/);
    for (let i = 0; i < words.length - 2; i++) {
      const threeWords = words.slice(i, i + 3).join('-').toLowerCase();
      if (path.toLowerCase().includes(threeWords)) {
        console.log(`✅ Found partial match using consecutive words: "${threeWords}"`);
        return true;
      }
    }
    
    // Match if the path contains the testId-like portion of the directory name
    const pathParts = path.split('/');
    for (const part of pathParts) {
      if (part.includes('cb4d7') && part.includes('search-bar')) {
        console.log(`✅ Found match in directory name containing test ID: "${part}"`);
        return true;
      }
    }
    
    // For debugging
    console.log(`Failed to match: "${path}" with test title: "${title}"`);
    console.log(`Sanitized title: "${sanitizedTitle}"`);
    
    return false;
  }
}

export default ApiReporter; 