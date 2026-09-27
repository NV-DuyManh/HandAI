import { SubmissionStatus, SubmissionResult } from '../types';

export interface RouteTarget {
  pathname: string;
  params?: Record<string, any>;
}

/**
 * Deterministically resolves the student mobile destination route
 * based on backend SubmissionResult payload.
 *
 * Precedence:
 * 1. Quality failures (NEEDS_RETAKE, CROP_REQUIRED) -> /results/quality-failure
 * 2. Out of scope (status == OUT_OF_SCOPE or reasonCode == 'OUT_OF_SCOPE') -> /results/out-of-scope
 * 3. Token ambiguity (NEEDS_CONFIRMATION) -> /results/token-confirmation
 * 4. Human teacher review required (REVIEW_REQUIRED with non-out-of-scope reason) -> /results/review-required
 * 5. Deterministic feedback ready (VALID -> /results/correct, INVALID -> /results/error-hint)
 */
export function resolveResultRoute(result: Partial<SubmissionResult>): RouteTarget {
  if (
    result.status === SubmissionStatus.NEEDS_RETAKE ||
    result.status === SubmissionStatus.CROP_REQUIRED
  ) {
    return {
      pathname: '/results/quality-failure',
      params: { issue: result.imageQualityIssue },
    };
  }

  if (
    result.status === SubmissionStatus.OUT_OF_SCOPE ||
    result.reasonCode === 'OUT_OF_SCOPE'
  ) {
    return {
      pathname: '/results/out-of-scope',
    };
  }

  if (result.status === SubmissionStatus.NEEDS_CONFIRMATION) {
    return {
      pathname: '/results/token-confirmation',
      params: { token: result.ambiguousToken?.value || '' },
    };
  }

  if (result.status === SubmissionStatus.REVIEW_REQUIRED) {
    return {
      pathname: '/results/review-required',
      params: {
        reasonCode: result.reasonCode || '',
        diagnostics: result.diagnostics ? JSON.stringify(result.diagnostics) : '',
      },
    };
  }

  if (result.validation?.decision === 'VALID' || (result.status === SubmissionStatus.FEEDBACK_READY && result.validation?.decision !== 'INVALID')) {
    return {
      pathname: '/results/correct',
    };
  }

  return {
    pathname: '/results/error-hint',
  };
}
