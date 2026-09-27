import { Platform } from 'react-native';
import apiClient from './apiClient';
import { ensureFileUri } from '../image/imagePipeline';
import { isHandAIMode } from '../../config/appMode';
import { tokenStorage } from '../auth/tokenStorage';

/**
 * Send a multipart POST request with file + string params.
 *
 * IMPORTANT — Two independent bugs must be avoided:
 *
 * 1. Expo SDK 57 overrides global.fetch with its own "winter/fetch" which
 *    converts FormData via convertFormDataAsync(). That code only handles
 *    string | Blob | {bytes()}. React Native's FormData file objects
 *    ({uri, name, type}) are NONE of those → throws
 *    "Unsupported FormDataPart implementation".
 *    FIX: Use XMLHttpRequest — it bypasses Expo's fetch and goes directly
 *    to React Native's native OkHttp networking layer.
 *
 * 2. On Android, OkHttp can struggle with mixed string + file FormData parts.
 *    FIX: Put string params in URL query string (Spring Boot @RequestParam
 *    reads from both), keep FormData file-only.
 */
async function postMultipart<T>(
  endpoint: string,
  fileField: { key: string; uri: string; name: string; type: string },
  stringParams: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Build FormData with the file part AND string parts in the HTTP body
  // (Prevents giant URL query strings from exceeding Tomcat's 8KB header buffer limit)
  const formData = new FormData();
  formData.append(fileField.key, {
    uri: fileField.uri,
    name: fileField.name,
    type: fileField.type,
  } as any);

  for (const [k, v] of Object.entries(stringParams)) {
    if (v !== undefined && v !== null) {
      formData.append(k, String(v));
    }
  }

  const url = path;

  const token = await tokenStorage.getAccessToken();
  const authHeaderStatus = token ? 'present' : 'absent';
  console.log(`[HAND_AI DEBUG]\nBefore OCR request log:\n\nEndpoint:\n${endpoint}\n\nAuth header:\n${authHeaderStatus}\n`);

  try {
    const response = await apiClient.post<T>(url, formData, {
      transformRequest: [(data) => data],
      signal,
    });
    console.log(`[HAND_AI DEBUG]\nResponse:\nstatus: ${response.status}\n`);
    return response.data;
  } catch (err: any) {
    const status = err?.response?.status;
    console.log(`[HAND_AI DEBUG]\nResponse:\nstatus: ${status || 'network error / no response'}\n`);
    throw err;
  }
}

export interface OcrTrialResult {
  trialId: string;
  status: string;
  recognizedText: string;
  predictedText?: string;
  verifiedTextRaw?: string;
  verifiedTextNormalized?: string;
  verdict: string;
  source: 'CAMERA' | 'GALLERY' | string;
  domain?: string;
  trainingEligible: boolean;
  privacyConfirmed?: boolean;
  isTestData?: boolean;
  confidence?: number | null;
  modelName?: string;
  modelVersion?: string;
  checkpointSha256?: string;
  vocabSha256?: string;
  preprocessingVersion?: string;
  createdAt?: string;
}

export interface OcrMetrics {
  totalTrials: number;
  reviewedTrials: number;
  correctedTrials: number;
  verifiedTrials: number;
  skippedTrials: number;
  averageConfidence: number;
  accuracyRate: number;
}

export type AdvisorDecision = 'AUTO_APPLY' | 'SUGGEST_ONLY' | 'KEEP_RAW';

export interface AdvisorSuggestion {
  provider: 'GROQ' | 'GEMINI' | string;
  model?: string;
  text: string;
  confidence: number;
  visualSupport?: string;
  decision?: AdvisorDecision;
  status?: string;
}

export interface LineBox {
  line_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  order: number;
  text?: string;
  rawOcrText?: string;
  rawOcrConfidence?: number;
  correctedText?: string;
  correctionConfidence?: number;
  correctionApplied?: boolean;
  correctionDecision?: AdvisorDecision;
  finalText?: string;
  predictedText?: string;
  minTokenConfidence?: number;
  p10TokenConfidence?: number;
  meanTokenConfidence?: number;
  blankRatio?: number;
  meanEntropy?: number;
  groqSuggestion?: string;
  groqConfidence?: number;
  groqDecision?: AdvisorDecision;
  groqStatus?: string;
  groqModel?: string;
  geminiSuggestion?: string;
  geminiConfidence?: number;
  geminiDecision?: AdvisorDecision;
  geminiStatus?: string;
  geminiModel?: string;
  suggestions?: AdvisorSuggestion[];
}

export interface MultilineDetectResult {
  width: number;
  height: number;
  lines: LineBox[];
  diagnostics?: Record<string, any>;
  requestId?: string;
}

export interface MultilineLineResult {
  lineId: string;
  lineOrder?: number;
  lineIndex?: number;
  boxX?: number;
  boxY?: number;
  boxWidth?: number;
  boxHeight?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  lineImageObjectKey?: string;
  lineImageSha256?: string;
  /** Legacy effective-text alias mirroring finalText for backwards compatibility */
  predictedText: string;
  confidence?: number;
  /** Immutable raw CRNN prediction / raw OCR output. Never mutated by post-correction or user edits. */
  rawOcrText?: string;
  rawOcrConfidence?: number;
  correctedText?: string;
  correctionConfidence?: number;
  correctionApplied?: boolean;
  correctionDecision?: AdvisorDecision;
  /** Current effective text for this line (CRNN raw, auto-applied, advisor choice, or manual edit) */
  finalText?: string;
  minTokenConfidence?: number;
  p10TokenConfidence?: number;
  meanTokenConfidence?: number;
  groqSuggestion?: string;
  groqConfidence?: number;
  groqDecision?: AdvisorDecision;
  groqStatus?: string;
  groqModel?: string;
  geminiSuggestion?: string;
  geminiConfidence?: number;
  geminiDecision?: AdvisorDecision;
  geminiStatus?: string;
  geminiModel?: string;
  suggestions?: AdvisorSuggestion[];

  blankRatio?: number;
  meanEntropy?: number;
  verifiedTextRaw?: string;
  verifiedTextNormalized?: string;
  verdict: string;
  trainingEligible: boolean;
  feedbackAt?: string;

  /** Canonical current text strictly from resolveLineDisplayState (PROD.4A.1) */
  currentText?: string;
  /** Selected source: OCR | SUGGESTION_1 | SUGGESTION_2 | MANUAL_EDIT */
  selectedSource?: 'OCR' | 'SUGGESTION_1' | 'SUGGESTION_2' | 'MANUAL_EDIT' | 'ocr' | 'suggestion_1' | 'suggestion_2' | 'manual_edit' | string;
  /** Selection reason explaining the decision */
  selectionReason?: string;
  decisionReason?: string;
}

export interface MultilineTrialResult {
  trialId: string;
  userId?: string;
  source: string;
  pageImageObjectKey: string;
  pageImageSha256: string;
  pageWidth: number;
  pageHeight: number;
  privacyConfirmed: boolean;
  isTestData: boolean;
  dataOrigin: string;
  status: string;
  createdAt: string;
  lines: MultilineLineResult[];
  canonicalMatched?: boolean;
  fixtureId?: string;
  recognitionSource?: string;
  recognitionEngine?: string;
  segmentationSource?: string;
  correctionSource?: string;
  finalTextSource?: string;
  requestId?: string;
  diagnostics?: Record<string, any>;
}

export class OcrPilotService {
  private static cachedTrials = new Map<string, MultilineTrialResult>();

  static cacheTrial(trial: MultilineTrialResult): void {
    if (trial && trial.trialId) {
      this.cachedTrials.set(trial.trialId, trial);
    }
  }

  static getCachedTrial(trialId: string): MultilineTrialResult | undefined {
    return this.cachedTrials.get(trialId);
  }

  static getAllCachedTrials(): MultilineTrialResult[] {
    return Array.from(this.cachedTrials.values());
  }

  // Helper to extract file info from a URI
  private static fileInfoFromUri(rawUri: string, fallbackName: string) {
    const cleanUri = ensureFileUri(Array.isArray(rawUri) ? rawUri[0] : rawUri);
    const rawFilename = cleanUri.split('/').pop() || fallbackName;
    const safeFilename = rawFilename.includes('.') ? rawFilename.split('?')[0] : fallbackName;
    const match = /\.(\w+)$/.exec(safeFilename);
    const type = match && match[1].toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
    const uri = Platform.OS === 'ios' ? cleanUri.replace('file://', '') : cleanUri;
    return { uri, name: safeFilename, type };
  }

  // Single-line Pilot 1 methods
  static async createTrial(
    uri: string, 
    source: 'CAMERA' | 'GALLERY' = 'CAMERA',
    isTestData: boolean = false,
    privacyConfirmed: boolean = true
  ): Promise<OcrTrialResult> {
    const file = this.fileInfoFromUri(uri, 'ocr_line.jpg');
    return await postMultipart<OcrTrialResult>(
      '/ocr/trials',
      { key: 'image', ...file },
      {
        source,
        isTestData: String(isTestData),
        privacyConfirmed: String(privacyConfirmed),
      },
    );
  }

  static async getTrial(trialId: string): Promise<OcrTrialResult> {
    const response = await apiClient.get<OcrTrialResult>(`/ocr/trials/${trialId}`);
    return response.data;
  }

  static async submitFeedback(
    trialId: string,
    verdict: 'CORRECT' | 'CORRECTED' | 'SKIPPED',
    verifiedText?: string,
    isTestData?: boolean
  ): Promise<OcrTrialResult> {
    const response = await apiClient.post<OcrTrialResult>(`/ocr/trials/${trialId}/feedback`, {
      verdict,
      verifiedText,
      isTestData,
    });
    return response.data;
  }

  static async getMetrics(): Promise<OcrMetrics> {
    const response = await apiClient.get<OcrMetrics>('/ocr/trials/metrics');
    return response.data;
  }

  private static getEndpoint(path: string): string {
    if (isHandAIMode()) {
      return `/handai${path}`;
    }
    return path;
  }

  // Multi-line Pilot 2 methods
  static async detectLines(
    uri: string,
    privacyConfirmed: boolean = true,
    forceRedetect: boolean = false
  ): Promise<MultilineDetectResult> {
    const file = this.fileInfoFromUri(uri, 'page.jpg');
    const endpoint = this.getEndpoint('/ocr/multiline/detect');
    console.log('[OCR_PILOT] Requesting detectLines for URI:', uri, '| Endpoint:', endpoint, '| BaseURL:', apiClient.defaults.baseURL);
    try {
      const result = await postMultipart<MultilineDetectResult>(
        endpoint,
        { key: 'image', ...file },
        { 
          privacyConfirmed: String(privacyConfirmed),
          forceRedetect: String(forceRedetect),
          _t: Date.now().toString()
        },
      );
      console.log('[OCR_PILOT] detectLines success:', {
        width: result.width,
        height: result.height,
        linesCount: result.lines?.length || 0,
        detectorVersion: (result as any).detectorVersion || (result as any).detector_version,
      });
      if (__DEV__ && result.diagnostics) {
        const d = result.diagnostics;
        result.requestId = d.requestId || (result as any).requestId;
        console.log(
          `[OCR-PHYSICAL]\n` +
          `requestId=${result.requestId || 'unknown'}\n` +
          `recognitionEngine=${d.recognitionEngine || 'CRNN'}\n` +
          `segmentationSource=${d.segmentationSource || 'LOCAL_CV'}\n` +
          `correctionSource=${d.correctionSource || 'NONE'}\n` +
          `finalTextSource=${d.finalTextSource || 'CRNN_RAW'}\n` +
          `groqLineAssistUsed=${d.groqLineAssistUsed ?? false}\n` +
          `groqCorrectionUsed=${d.groqCorrectionUsed ?? false}\n` +
          `groqCalls=${d.groqCalls ?? 0}\n` +
          `lineCount=${result.lines?.length || 0}\n` +
          `totalLatencyMs=${d.totalLatencyMs ?? 'N/A'}`
        );
      }
      return result;
    } catch (err: any) {
      console.error('[OCR_PILOT] detectLines network/server error:', err?.message || err, err?.response?.data);
      throw err;
    }
  }

  static minimizeLineForTransport(line: LineBox): Partial<LineBox> {
    const effectiveOcr = (line.rawOcrText || line.text || '').trim();
    const effectiveFinal = (line.finalText || effectiveOcr).trim();
    return {
      line_id: line.line_id,
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height,
      order: line.order,
      text: effectiveFinal || effectiveOcr,
      rawOcrText: effectiveOcr,
      rawOcrConfidence: line.rawOcrConfidence ?? undefined,
      finalText: effectiveFinal || effectiveOcr,
      predictedText: effectiveFinal || effectiveOcr,
      groqSuggestion: line.groqSuggestion ?? undefined,
      groqConfidence: line.groqConfidence ?? undefined,
      groqDecision: line.groqDecision ?? undefined,
      groqStatus: line.groqStatus ?? undefined,
      groqModel: line.groqModel ?? undefined,
      geminiSuggestion: line.geminiSuggestion ?? undefined,
      geminiConfidence: line.geminiConfidence ?? undefined,
      geminiDecision: line.geminiDecision ?? undefined,
      geminiStatus: line.geminiStatus ?? undefined,
      geminiModel: line.geminiModel ?? undefined,
      correctedText: line.correctedText ?? undefined,
      correctionApplied: line.correctionApplied ?? undefined,
      correctionDecision: line.correctionDecision ?? undefined,
      // Keep suggestions only if needed for fallback compatibility
      suggestions: line.suggestions && line.suggestions.length > 0 ? line.suggestions : undefined,
    };
  }

  static async createMultilineTrial(
    uri: string,
    confirmedLines: LineBox[],
    source: 'CAMERA' | 'GALLERY' = 'CAMERA',
    privacyConfirmed: boolean = true,
    signal?: AbortSignal
  ): Promise<MultilineTrialResult> {
    const file = this.fileInfoFromUri(uri, 'page.jpg');
    const minimizedLines = confirmedLines.map((l) => this.minimizeLineForTransport(l));
    const endpoint = this.getEndpoint('/ocr/multiline/trials');
    const res = await postMultipart<MultilineTrialResult>(
      endpoint,
      { key: 'image', ...file },
      {
        source,
        privacyConfirmed: String(privacyConfirmed),
        confirmedLines: JSON.stringify(minimizedLines),
      },
      signal
    );
    if (res && res.trialId) {
      this.cacheTrial(res);
    }
    return res;
  }

  static async getMultilineTrial(trialId: string): Promise<MultilineTrialResult> {
    const endpoint = this.getEndpoint(`/ocr/multiline/trials/${trialId}`);
    const response = await apiClient.get<MultilineTrialResult>(endpoint);
    return response.data;
  }

  static async submitLineFeedback(
    trialId: string,
    lineId: string,
    verdict: 'CORRECT' | 'CORRECTED' | 'SKIPPED',
    verifiedText?: string
  ): Promise<MultilineLineResult> {
    const endpoint = this.getEndpoint(`/ocr/multiline/trials/${trialId}/lines/${lineId}/feedback`);
    const response = await apiClient.post<MultilineLineResult>(
      endpoint,
      {
        verdict,
        verifiedText,
      }
    );
    return response.data;
  }
}

/**
 * Normalized user-facing error handler for handwriting OCR workflows.
 * Replaces cryptic AxiosError and HTTP status codes with kid-friendly Vietnamese messages.
 */
export function normalizeOcrError(err: any): { title: string; message: string; technical?: string } {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const backendCode = data?.error?.code || data?.code;
  const technical = `status=${status || 'N/A'}, code=${backendCode || 'N/A'}, message=${err?.message || 'N/A'}`;

  if (status === 400) {
    return {
      title: 'Chưa thể xử lý các dòng chữ',
      message: 'Một số dòng chưa hợp lệ. Em hãy kiểm tra lại các khung chữ rồi thử tiếp.',
      technical,
    };
  }
  if (status === 401 || status === 403) {
    if (isHandAIMode()) {
      return {
        title: 'Recognition Service Unavailable',
        message: 'The handwriting recognition service is currently unavailable. Please retry.',
        technical,
      };
    }
    return {
      title: 'Phiên đăng nhập hết hạn',
      message: 'Phiên đăng nhập của em đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.',
      technical,
    };
  }
  if (status === 404) {
    return {
      title: 'Phiên nhận diện hết hạn',
      message: 'Phiên nhận diện đã hết hạn. Vui lòng nhận diện lại ảnh.',
      technical,
    };
  }
  if (status && status >= 500) {
    return {
      title: 'Hệ thống đang bận',
      message: 'Hệ thống đang bận. Vui lòng thử lại sau ít phút.',
      technical,
    };
  }
  if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
    return {
      title: 'Hết thời gian chờ',
      message: 'Hệ thống phản hồi lâu hơn dự kiến. Em hãy kiểm tra mạng và thử lại nhé.',
      technical,
    };
  }
  if (err?.message?.includes('Network Error') || !err?.response) {
    return {
      title: 'Không thể kết nối',
      message: 'Không thể kết nối đến hệ thống. Hãy kiểm tra mạng và thử lại.',
      technical,
    };
  }
  return {
    title: 'Chưa thể nhận diện',
    message: 'Đã có lỗi xảy ra trong quá trình nhận diện. Em hãy thử lại nhé.',
    technical,
  };
}


