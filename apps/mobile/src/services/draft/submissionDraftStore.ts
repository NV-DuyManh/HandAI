import { isHandAIMode } from '../../config/appMode';

export type FlowDomain = 'HANDWRITING_TEXT' | 'ARITHMETIC' | 'OCR_PILOT' | 'OCR_PILOT_MULTILINE';

export function isHandwritingDomain(mode?: string | null): boolean {
  return mode === 'HANDWRITING_TEXT' || mode === 'OCR_PILOT' || mode === 'OCR_PILOT_MULTILINE';
}

export function isValidFlowDomain(mode: any): mode is FlowDomain {
  return mode === 'HANDWRITING_TEXT' || mode === 'ARITHMETIC' || mode === 'OCR_PILOT' || mode === 'OCR_PILOT_MULTILINE';
}

/**
 * Single source of truth for flow domain resolution.
 */
export function resolveFlowDomain(explicitMode?: string | null, draftMode?: string | null): FlowDomain {
  if (explicitMode && isValidFlowDomain(explicitMode)) {
    return explicitMode;
  }
  if (draftMode && isValidFlowDomain(draftMode)) {
    return draftMode;
  }
  if (explicitMode || draftMode) {
    if (__DEV__) {
      console.warn(`[FLOW_DOMAIN][FALLBACK] Invalid/missing mode (explicit=${explicitMode}, draft=${draftMode}). Failing closed to HANDWRITING_TEXT.`);
    }
  }
  return 'HANDWRITING_TEXT';
}

export function logFlowDomain(stage: 'ACQUIRE' | 'PRIVACY' | 'POST_PRIVACY' | 'RESULT' | string, domain: FlowDomain): void {
  console.log(`[FLOW_DOMAIN][${stage}] ${domain}`);
}

export interface ImageDraft {
  imageSessionId?: string;
  originalImageUri?: string; // IMMUTABLE source of truth from camera/gallery
  originalUri?: string;
  sourceImageUri?: string;
  privacyImageUri?: string;
  croppedImageUri?: string;
  rawUri: string;
  uri: string;
  width: number;
  height: number;
  mimeType: string;
  filename: string;
  source?: 'CAMERA' | 'GALLERY';
  mode?: FlowDomain;
  masks?: { id: number; x: number; y: number; width: number; height: number }[];
  isMasked?: boolean;
  retrySubmissionId?: string;
  createdAt?: number;
}

export function logImageFlow(context: {
  originalUri?: string;
  privacyUri?: string;
  cropInputUri?: string;
  activeRecognitionUri?: string;
}): void {
  console.log(`[IMAGE_FLOW]
originalUri=${context.originalUri || 'undefined'}
privacyUri=${context.privacyUri || 'undefined'}
cropInputUri=${context.cropInputUri || 'undefined'}
activeRecognitionUri=${context.activeRecognitionUri || 'undefined'}
`);
}

function normalizeDraftFileUri(uri?: string): string {
  if (!uri || typeof uri !== 'string') return '';
  let clean = uri.trim();
  if (
    !clean.startsWith('file://') &&
    !clean.startsWith('content://') &&
    !clean.startsWith('http://') &&
    !clean.startsWith('https://')
  ) {
    clean = clean.startsWith('/') ? `file://${clean}` : `file:///${clean}`;
  }
  return clean;
}

class SubmissionDraftStore {
  private currentDraft: ImageDraft | null = null;

  setDraft(draft: Omit<ImageDraft, 'createdAt'>): ImageDraft {
    const isHandAI = isHandAIMode();
    const isPrivacyArtifact = (u?: string) => !!u && (u.includes('privacy') || u.includes('viewshot') || u.includes('masked') || u.includes('ViewShot'));
    
    // Resolve true original URI from camera or gallery
    let pristineUri = draft.originalImageUri || draft.originalUri;
    if (!pristineUri || isPrivacyArtifact(pristineUri)) {
      pristineUri = !isPrivacyArtifact(draft.sourceImageUri)
        ? draft.sourceImageUri
        : (!isPrivacyArtifact(draft.rawUri) ? draft.rawUri : draft.uri);
    }

    const sourceUri = normalizeDraftFileUri(pristineUri || draft.uri);

    const finalDraft: ImageDraft = {
      ...draft,
      originalImageUri: sourceUri,
      originalUri: sourceUri,
      sourceImageUri: sourceUri,
      privacyImageUri: isHandAI ? undefined : draft.privacyImageUri,
      isMasked: isHandAI ? false : (draft.isMasked ?? false),
      uri: isHandAI ? (draft.croppedImageUri || sourceUri) : draft.uri,
      createdAt: Date.now(),
    };

    this.currentDraft = finalDraft;

    logImageFlow({
      originalUri: sourceUri,
      privacyUri: isHandAI ? undefined : draft.privacyImageUri,
      cropInputUri: sourceUri,
      activeRecognitionUri: draft.croppedImageUri || sourceUri,
    });

    return this.currentDraft;
  }

  getDraft(): ImageDraft | null {
    if (!this.currentDraft) return null;
    const isHandAI = isHandAIMode();
    if (isHandAI) {
      // In HandAI mode: guarantee privacyImageUri is never exposed or returned
      const cleanOriginal = this.currentDraft.originalImageUri || this.currentDraft.originalUri || this.currentDraft.sourceImageUri || this.currentDraft.rawUri;
      return {
        ...this.currentDraft,
        originalImageUri: cleanOriginal,
        originalUri: cleanOriginal,
        sourceImageUri: cleanOriginal,
        privacyImageUri: undefined,
        isMasked: false,
        uri: this.currentDraft.croppedImageUri || cleanOriginal,
      };
    }
    return this.currentDraft;
  }

  updateDraft(patch: Partial<ImageDraft>): ImageDraft | null {
    if (!this.currentDraft) return null;
    const isHandAI = isHandAIMode();
    
    // Safeguard: Never let a privacy/screenshot URI overwrite the pristine originalImageUri
    const isPrivacyArtifact = (u?: string) => !!u && (u.includes('privacy') || u.includes('viewshot') || u.includes('masked') || u.includes('ViewShot'));
    
    let safeOriginalImageUri = this.currentDraft.originalImageUri;
    if (patch.originalImageUri && !isPrivacyArtifact(patch.originalImageUri)) {
      safeOriginalImageUri = normalizeDraftFileUri(patch.originalImageUri);
    }

    this.currentDraft = {
      ...this.currentDraft,
      ...patch,
      originalImageUri: safeOriginalImageUri,
      originalUri: safeOriginalImageUri,
      sourceImageUri: safeOriginalImageUri,
      ...(isHandAI ? {
        privacyImageUri: undefined,
        isMasked: false,
      } : {}),
    };

    return this.currentDraft;
  }

  clearDraft(): void {
    this.currentDraft = null;
  }
}

export const submissionDraftStore = new SubmissionDraftStore();
