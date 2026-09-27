import {
  SubmissionResult,
  SubmissionStatus,
  Decision,
  ErrorType,
  ImageQualityIssue,
  SubmissionService,
} from '../../types';

// Mock delays to simulate network & AI processing
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// In-memory store for mock submissions
const submissionsStore: Record<string, SubmissionResult> = {};

export class MockSubmissionServiceClass implements SubmissionService {
  /**
   * Upload an image to get a submission result.
   * In a real app, this would be a multipart/form-data upload.
   * Here, we use the filename/uri to determine which mock scenario to return.
   */
  async uploadImage(uri: string): Promise<SubmissionResult> {
    await delay(1000); // Simulate upload delay

    const id = `sub_${Date.now()}`;
    let result: SubmissionResult;

    const uriLower = uri.toLowerCase();

    if (uriLower.includes('mock-blur')) {
      result = {
        id,
        status: SubmissionStatus.NEEDS_RETAKE,
        imageQualityIssue: ImageQualityIssue.BLUR,
      };
    } else if (uriLower.includes('mock-crop')) {
      result = {
        id,
        status: SubmissionStatus.CROP_REQUIRED,
        imageQualityIssue: ImageQualityIssue.INCOMPLETE_CROP,
      };
    } else if (uriLower.includes('mock-out-of-scope')) {
      result = {
        id,
        status: SubmissionStatus.OUT_OF_SCOPE,
      };
    } else if (uriLower.includes('mock-review-layout')) {
      result = {
        id,
        status: SubmissionStatus.REVIEW_REQUIRED,
        reasonCode: 'INVALID_LAYOUT',
        diagnostics: {
          detectorInvoked: true,
          detectorTokenCount: 6,
          ocrInvoked: false,
          parserInvoked: true,
          parserStatus: 'INVALID_LAYOUT',
          validatorInvoked: false,
          validatorStatus: 'N/A',
          qualityFlags: [],
          reasonCode: 'INVALID_LAYOUT',
        },
      };
    } else if (uriLower.includes('mock-review-empty')) {
      result = {
        id,
        status: SubmissionStatus.REVIEW_REQUIRED,
        reasonCode: 'DETECTOR_NO_TOKENS',
        diagnostics: {
          detectorInvoked: true,
          detectorTokenCount: 0,
          ocrInvoked: false,
          parserInvoked: false,
          parserStatus: 'SKIPPED',
          validatorInvoked: false,
          validatorStatus: 'SKIPPED',
          qualityFlags: [],
          reasonCode: 'DETECTOR_NO_TOKENS',
        },
      };
    } else if (uriLower.includes('mock-review')) {
      result = {
        id,
        status: SubmissionStatus.REVIEW_REQUIRED,
        reasonCode: 'OCR_LOW_CONFIDENCE',
        diagnostics: {
          detectorInvoked: true,
          detectorTokenCount: 5,
          ocrInvoked: true,
          ocrTextLength: 4,
          parserInvoked: true,
          parserStatus: 'UNCERTAIN',
          validatorInvoked: false,
          validatorStatus: 'SKIPPED',
          qualityFlags: ['SLIGHT_BLUR'],
          reasonCode: 'OCR_LOW_CONFIDENCE',
        },
      };
    } else {
      // Default to PROCESSING for the standard paths (correct, error, confirm)
      result = {
        id,
        status: SubmissionStatus.PROCESSING,
      };
    }

    submissionsStore[id] = result;
    return result;
  }

  /**
   * Poll for submission status.
   * Simulates the async nature of the AI processing workers.
   */
  async getSubmission(id: string, scenarioHint?: string): Promise<SubmissionResult> {
    await delay(800);
    const sub = submissionsStore[id];
    
    if (!sub) {
      throw new Error('Submission not found');
    }

    // Simulate state transition if it's currently PROCESSING
    if (sub.status === SubmissionStatus.PROCESSING) {
      // For demo purposes, we randomly pick a scenario if none provided, 
      // or use a hint stored during upload. We'll use the hint.
      const hint = scenarioHint || 'mock-correct';

      if (hint === 'mock-correct') {
        submissionsStore[id] = {
          ...sub,
          status: SubmissionStatus.FEEDBACK_READY,
          validation: {
            decision: Decision.VALID,
          },
          studentFeedback: {
            title: 'Làm tốt lắm! 🎉',
            hint: 'MathVision chưa tìm thấy lỗi trong bài em vừa kiểm tra.',
            revealAnswer: false,
          }
        };
      } else if (hint === 'mock-earliest-error') {
        submissionsStore[id] = {
          ...sub,
          status: SubmissionStatus.FEEDBACK_READY,
          validation: {
            decision: Decision.INVALID,
            firstInvalidIndex: 1, // Tens column
            errorType: ErrorType.COMPUTATION_ERROR,
          },
          studentFeedback: {
            title: 'Hãy xem lại hàng chục',
            hint: 'Em nhớ kiểm tra số nhớ từ hàng đơn vị trước khi cộng các số ở hàng chục nhé.',
            revealAnswer: false,
          }
        };
      } else if (hint === 'mock-confirm') {
        submissionsStore[id] = {
          ...sub,
          status: SubmissionStatus.NEEDS_CONFIRMATION,
          ambiguousToken: {
            value: '7',
            isAmbiguous: true,
          }
        };
      }
    }

    return submissionsStore[id];
  }

  /**
   * Confirm an ambiguous token
   */
  async confirmToken(id: string, token: string): Promise<SubmissionResult> {
    await delay(600);
    const sub = submissionsStore[id];
    if (!sub) throw new Error('Submission not found');

    // After confirmation, we transition to CORRECT for the demo
    const updated = {
      ...sub,
      status: SubmissionStatus.FEEDBACK_READY,
      ambiguousToken: undefined, // Cleared
      validation: { decision: Decision.VALID },
      studentFeedback: {
        title: 'Làm tốt lắm! 🎉',
        hint: 'MathVision chưa tìm thấy lỗi trong bài em vừa kiểm tra.',
        revealAnswer: false,
      }
    };
    
    submissionsStore[id] = updated;
    return updated;
  }

  /**
   * Retry a submission (e.g. after error)
   */
  async retrySubmission(id: string, uri: string): Promise<SubmissionResult> {
    // In a real system this might create a new linked submission or update state
    await delay(500);
    return {
      id: `sub_${Date.now()}`,
      status: SubmissionStatus.PROCESSING,
    };
  }
}

export const MockSubmissionService = new MockSubmissionServiceClass();
