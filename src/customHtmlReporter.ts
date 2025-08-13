import { Reporter, TestCase, TestResult, FullConfig, FullResult, Suite, TestError, TestStep } from '@playwright/test/reporter';
import * as path from 'path';

/**
 * Custom reporter that corrects file paths and delegates to the HTML reporter
 * This reporter should be used in conjunction with the built-in HTML reporter
 */
class CustomHtmlReporter implements Reporter {
  private correctedTests = new Set<string>();

  onBegin(config: FullConfig, suite: Suite) {
    // Correct file paths in the suite tree at the beginning
    this.correctSuiteFilePaths(suite);
  }

  onTestBegin(test: TestCase) {
    // Correct the test's file location when test begins
    this.correctTestFilePath(test);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Ensure the correction persists
    this.correctTestFilePath(test);
  }

  // Forward console output and other events to preserve logs
  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    // Forward stdout to console
    process.stdout.write(chunk);
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    // Forward stderr to console
    process.stderr.write(chunk);
  }

  async onEnd() {
    // Reporter cleanup if needed
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
   * Recursively correct file paths in the suite tree
   */
  private correctSuiteFilePaths(suite: Suite) {
    // Correct the suite's location if needed
    if (suite.location?.file?.includes('stagehandFixture.ts')) {
      const correctedPath = this.extractFilePathFromSuite(suite);
      if (correctedPath && correctedPath !== suite.location.file) {
        console.log(`Correcting suite file path from ${suite.location.file} to ${correctedPath}`);
        (suite as any).location = {
          ...suite.location,
          file: correctedPath,
          line: 0,
          column: 0
        };
      }
    }

    // Process all child suites
    for (const child of suite.suites) {
      this.correctSuiteFilePaths(child);
    }

    // Process all tests in this suite
    for (const test of suite.tests) {
      this.correctTestFilePath(test);
    }
  }

  /**
   * Extract the real file path from a suite
   */
  private extractFilePathFromSuite(suite: Suite): string {
    // Check if the suite title looks like a file path
    if (suite.title.endsWith('.spec.ts') || suite.title.endsWith('.spec.js')) {
      return suite.title;
    }

    // For file suites, the title is often the relative path
    if ((suite as any)._type === 'file' && suite.title) {
      // Check if it's a relative path that needs to be resolved
      if (!suite.title.startsWith('/') && (suite.title.includes('/') || suite.title.endsWith('.spec.ts'))) {
        return suite.title;
      }
    }

    // Check parent recursively
    if (suite.parent) {
      const parentPath = this.extractFilePathFromSuite(suite.parent);
      if (parentPath && !parentPath.includes('stagehandFixture.ts')) {
        return parentPath;
      }
    }

    return suite.location?.file || '';
  }

  /**
   * Correct a test's file path using the same logic as ApiReporter
   */
  private correctTestFilePath(test: TestCase) {
    // Create a unique ID for this test to avoid correcting multiple times
    const testId = `${test.title}-${test.location?.file}`;
    
    if (!test.location?.file?.includes('stagehandFixture.ts') || this.correctedTests.has(testId)) {
      return;
    }

    let correctedPath = test.location.file;

    // Try to get the file path from titlePath
    const titlePathArr = this.getTitlePathArray(test);
    if (titlePathArr.length > 0) {
      const firstPath = titlePathArr[0];
      if (firstPath.endsWith('.spec.ts') || firstPath.endsWith('.spec.js')) {
        correctedPath = firstPath;
      }
    }

    // If still not found, traverse parent chain
    if (correctedPath.includes('stagehandFixture.ts')) {
      let current: any = test.parent;
      while (current) {
        // Check location
        if (current.location?.file && !current.location.file.includes('stagehandFixture.ts')) {
          correctedPath = current.location.file;
          break;
        }

        // Check title
        if (current.title && (current.title.endsWith('.spec.ts') || current.title.endsWith('.spec.js'))) {
          correctedPath = current.title;
          break;
        }

        // For file suites
        if (current._type === 'file' && current.title) {
          if (!current.title.startsWith('/') && (current.title.includes('/') || current.title.endsWith('.spec.ts'))) {
            correctedPath = current.title;
            break;
          }
        }

        // Check parent's titlePath
        const parentTitlePath = this.getTitlePathArray(current);
        if (parentTitlePath.length > 0) {
          const parentFirstPath = parentTitlePath[0];
          if (parentFirstPath.endsWith('.spec.ts') || parentFirstPath.endsWith('.spec.js')) {
            correctedPath = parentFirstPath;
            break;
          }
        }

        current = current.parent;
      }
    }

    // Update the test's location
    if (correctedPath !== test.location.file) {
      console.log(`Correcting test "${test.title}" file path from ${test.location.file} to ${correctedPath}`);
      
      // Modify the test object directly
      (test as any).location = {
        ...test.location,
        file: correctedPath,
        line: 0,  // Reset line number since it won't be accurate
        column: 0 // Reset column number since it won't be accurate
      };

      // Also update parent suite locations if they have stagehandFixture
      let parent: Suite | null = test.parent;
      while (parent) {
        if (parent.location?.file?.includes('stagehandFixture.ts')) {
          (parent as any).location = {
            ...parent.location,
            file: correctedPath,
            line: 0,
            column: 0
          };
        }
        parent = parent.parent || null;
      }

      this.correctedTests.add(testId);
    }
  }
}

export default CustomHtmlReporter; 