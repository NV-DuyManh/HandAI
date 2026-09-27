export type FlowDomain = 'HANDWRITING_TEXT' | 'ARITHMETIC' | 'OCR_PILOT' | 'OCR_PILOT_MULTILINE';

export enum SubmissionStatus {
  PROCESSING = 'PROCESSING',
  FEEDBACK_READY = 'FEEDBACK_READY',
  NEEDS_CONFIRMATION = 'NEEDS_CONFIRMATION',
  NEEDS_RETAKE = 'NEEDS_RETAKE',
  CROP_REQUIRED = 'CROP_REQUIRED',
  OUT_OF_SCOPE = 'OUT_OF_SCOPE',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
}

export enum Decision {
  VALID = 'VALID',
  INVALID = 'INVALID',
  UNCERTAIN = 'UNCERTAIN',
}

export enum ErrorType {
  COMPUTATION_ERROR = 'COMPUTATION_ERROR',
  CARRY_BORROW_ERROR = 'CARRY_BORROW_ERROR',
  PLACE_VALUE_ALIGNMENT_ERROR = 'PLACE_VALUE_ALIGNMENT_ERROR',
  NOTATION_ISSUE = 'NOTATION_ISSUE',
}

export enum ImageQualityIssue {
  BLUR = 'BLUR',
  DARK = 'DARK',
  GLARE = 'GLARE',
  SKEW = 'SKEW',
  INCOMPLETE_CROP = 'INCOMPLETE_CROP',
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RecognizedToken {
  value: string;
  box?: BoundingBox;
  confidence?: number;
  isAmbiguous?: boolean;
}

export interface RecognizedExercise {
  operator: string;
  operands: RecognizedToken[];
  observedResult: RecognizedToken[];
  carryMarks?: RecognizedToken[];
}

export interface ColumnValidation {
  columnIndex: number;
  expectedValue: string;
  actualValue: string;
  isValid: boolean;
  errorType?: ErrorType;
}

export interface Validation {
  decision: Decision;
  columns?: ColumnValidation[];
  firstInvalidIndex?: number;
  errorType?: ErrorType;
}

export interface StudentFeedback {
  title: string;
  hint: string;
  revealAnswer: boolean;
}

export interface RecognitionAttemptDiagnostics {
  detectorInvoked?: boolean;
  detectorTokenCount?: number;
  ocrInvoked?: boolean;
  ocrTextLength?: number;
  parserInvoked?: boolean;
  parserStatus?: string;
  validatorInvoked?: boolean;
  validatorStatus?: string;
  qualityFlags?: string[];
  reasonCode?: string;
}

export interface SubmissionResult {
  id: string;
  status: SubmissionStatus;
  recognizedExercise?: RecognizedExercise;
  validation?: Validation;
  studentFeedback?: StudentFeedback;
  imageQualityIssue?: ImageQualityIssue;
  ambiguousToken?: RecognizedToken;
  reasonCode?: string;
  diagnostics?: RecognitionAttemptDiagnostics;
  flowDomain?: FlowDomain;
}

export interface SubmissionService {
  uploadImage(uri: string): Promise<SubmissionResult>;
  getSubmission(id: string, scenarioHint?: string): Promise<SubmissionResult>;
  confirmToken(id: string, token: string): Promise<SubmissionResult>;
  retrySubmission(id: string, uri: string): Promise<SubmissionResult>;
}
