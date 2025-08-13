import { Page } from '@playwright/test';

/**
 * Utility functions for correlating test steps with video timestamps
 */

/**
 * Add a timestamped step to the test progress tracker
 * @param page - The Playwright page object with progress tracker
 * @param description - Description of the step
 * @param success - Whether the step was successful
 */
export function addTimestampedStep(page: Page & { progressTracker?: any }, description: string, success: boolean = true): void {
  if (page.progressTracker) {
    page.progressTracker.addStep(description, success);
  }
}

/**
 * Get steps with video timestamps for debugging or reporting
 * @param page - The Playwright page object with progress tracker
 * @returns Array of steps with video timestamps
 */
export function getStepsWithVideoTimestamps(page: Page & { progressTracker?: any }): Array<{description: string, videoTimestamp: string}> {
  if (page.progressTracker) {
    return page.progressTracker.getStepsWithVideoTimestamps();
  }
  return [];
}

/**
 * Print current steps with video timestamps to console
 * @param page - The Playwright page object with progress tracker
 */
export function logStepsWithVideoTimestamps(page: Page & { progressTracker?: any }): void {
  const steps = getStepsWithVideoTimestamps(page);
  if (steps.length > 0) {
    console.log('\n=== Test Steps with Video Timestamps ===');
    steps.forEach((step, index) => {
      console.log(`Step ${index + 1}: ${step.description} [Video: ${step.videoTimestamp}]`);
    });
    console.log('========================================\n');
  }
}

/**
 * Create a video timestamp URL (if using a video player that supports timestamp URLs)
 * @param page - The Playwright page object with progress tracker
 * @param stepIndex - The index of the step (0-based)
 * @param videoUrl - Base URL of the video
 * @returns URL with timestamp parameter
 */
export function createVideoTimestampUrl(page: Page & { progressTracker?: any }, stepIndex: number, videoUrl: string): string {
  if (page.progressTracker) {
    const steps = page.progressTracker.getSteps();
    if (steps[stepIndex] && steps[stepIndex].videoTimestamp) {
      const timestampInSeconds = Math.floor(steps[stepIndex].videoTimestamp / 1000);
      return `${videoUrl}#t=${timestampInSeconds}`;
    }
  }
  return videoUrl;
}

/**
 * Generate a simple HTML report with video timestamps
 * @param page - The Playwright page object with progress tracker
 * @param videoFileName - Name of the video file
 * @returns HTML string
 */
export function generateVideoTimestampReport(page: Page & { progressTracker?: any }, videoFileName: string = 'video.webm'): string {
  if (!page.progressTracker) {
    return '<p>No progress tracker available</p>';
  }

  const steps = page.progressTracker.getSteps();
  let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Steps with Video Timestamps</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .step { margin: 10px 0; padding: 10px; border-left: 3px solid #007ACC; background: #f8f9fa; }
        .timestamp { color: #007ACC; font-weight: bold; }
        .video-link { color: #28a745; text-decoration: none; }
        .video-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>Test Steps with Video Timestamps</h1>
    <video controls width="800">
        <source src="${videoFileName}" type="video/webm">
        Your browser does not support the video tag.
    </video>
    <h2>Steps</h2>
`;

  steps.forEach((step: { description: string; videoTimestamp?: number }, index: number) => {
    const timestampInSeconds = step.videoTimestamp ? Math.floor(step.videoTimestamp / 1000) : 0;
    const timestampFormatted = step.videoTimestamp 
      ? page.progressTracker.formatDuration ? page.progressTracker.formatDuration(step.videoTimestamp) : 'N/A'
      : 'N/A';
    
    html += `
    <div class="step">
        <strong>Step ${index + 1}:</strong> ${step.description}<br>
        <span class="timestamp">Video Timestamp: ${timestampFormatted}</span>
        ${step.videoTimestamp ? `<br><a href="#" class="video-link" onclick="document.querySelector('video').currentTime=${timestampInSeconds}; document.querySelector('video').play();">Jump to this step in video</a>` : ''}
    </div>
`;
  });

  html += `
</body>
</html>
`;

  return html;
} 