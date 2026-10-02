import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import apiClient from './apiClient';
import { ensureFileUri } from '../image/imagePipeline';
import { isHandAIMode } from '../../config/appMode';
import { tokenStorage } from '../auth/tokenStorage';

/**
 * Send a multipart POST request with file + string params.
 */
async function postMultipart<T>(
  endpoint: string,
  fileField: { key: string; uri: string; name: string; type: string },
  stringParams: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const formData = new FormData();
  if (Platform.OS === 'web') {
    const imageResponse = await fetch(fileField.uri, { signal });
    if (!imageResponse.ok) throw new Error('Could not read the selected image.');
    formData.append(fileField.key, await imageResponse.blob(), fileField.name);
  } else {
    formData.append(fileField.key, {
      uri: fileField.uri,
      name: fileField.name,
      type: fileField.type,
    } as any);
  }

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
  confidenceSource?: string | null;
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
  confidence?: number | null;
  confidenceSource?: string | null;
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
  rawOcrConfidence?: number | null;
  rawOcrConfidenceSource?: string | null;
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
  groqConfidence?: number | null;
  groqConfidenceSource?: string | null;
  groqDecision?: AdvisorDecision;
  groqStatus?: string;
  groqModel?: string;
  geminiSuggestion?: string;
  geminiConfidence?: number | null;
  geminiConfidenceSource?: string | null;
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
  predictedText: string;
  confidence?: number | null;
  rawOcrText?: string;
  rawOcrConfidence?: number | null;
  rawOcrConfidenceSource?: string | null;
  correctedText?: string;
  correctionConfidence?: number;
  correctionApplied?: boolean;
  correctionDecision?: AdvisorDecision;
  finalText?: string;
  minTokenConfidence?: number;
  p10TokenConfidence?: number;
  meanTokenConfidence?: number;
  groqSuggestion?: string;
  groqConfidence?: number | null;
  groqConfidenceSource?: string | null;
  groqDecision?: AdvisorDecision;
  groqStatus?: string;
  groqModel?: string;
  geminiSuggestion?: string;
  geminiConfidence?: number | null;
  geminiConfidenceSource?: string | null;
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
  currentText?: string;
  selectedSource?: string;
  selectionReason?: string;
  decisionReason?: string;
  groundTruth?: string;
  referenceConfirmed?: boolean;
}

export interface MultilineTrialResult {
  trialId: string;
  /** Measured client duration of image preparation and the recognition request. */
  totalLatencyMs?: number;
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
  private static detectionCache = new Map<string, MultilineDetectResult>();

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

  static removeCachedTrials(trialIds: string[]): void {
    trialIds.forEach((id) => this.cachedTrials.delete(id));
    this.clearDetectionCache();
  }

  static clearDetectionCache(): void {
    this.detectionCache.clear();
  }

  /**
   * Health check before running heavy OCR operations.
   * Hits Spring Boot /api/v1/handai/health with a fast timeout (4000ms).
   */
  static async checkOcrServerHealth(timeoutMs: number = 4000): Promise<{
    ok: boolean;
    mode?: string;
    status?: string;
    message?: string;
  }> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await apiClient.get('/handai/health', {
        signal: controller.signal,
        timeout: timeoutMs,
      });
      clearTimeout(timer);
      if (res.status === 200 && (res.data?.status === 'UP' || res.data?.mode)) {
        return { ok: true, mode: res.data.mode, status: res.data.status };
      }
      return { ok: false, message: 'Server health check returned non-UP status' };
    } catch (err: any) {
      console.warn('[OCR_PILOT] Server health check failed:', err?.message || err);
      return {
        ok: false,
        message: err?.message?.includes('timeout')
          ? 'Hết thời gian chờ kết nối máy chủ'
          : 'Không thể kết nối OCR server. Kiểm tra backend hoặc mạng.',
      };
    }
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

  /**
   * Prepares and optimizes image prior to upload:
   * Resizes max width to 800px with 80% JPEG quality to prevent bandwidth saturation
   * while preserving handwriting stroke clarity for CRNN.
   */
  private static async prepareOptimizedImage(rawUri: string, fallbackName: string): Promise<{
    uri: string;
    name: string;
    type: string;
    prepTimeMs: number;
    width?: number;
    height?: number;
  }> {
    const t0 = Date.now();
    const cleanUri = ensureFileUri(Array.isArray(rawUri) ? rawUri[0] : rawUri);

    try {
      if (Platform.OS === 'web' || !cleanUri) {
        return { ...this.fileInfoFromUri(cleanUri, fallbackName), prepTimeMs: 0 };
      }

      const manipulated = await ImageManipulator.manipulateAsync(
        cleanUri,
        [{ resize: { width: 800 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      const prepTimeMs = Date.now() - t0;
      console.log(`[OCR_METRICS] IMAGE_PREP_DONE | width=${manipulated.width} | height=${manipulated.height} | duration=${prepTimeMs}ms`);

      const filename = fallbackName.endsWith('.jpg') ? fallbackName : `${fallbackName}.jpg`;
      const uri = Platform.OS === 'ios' ? manipulated.uri.replace('file://', '') : manipulated.uri;
      return {
        uri,
        name: filename,
        type: 'image/jpeg',
        prepTimeMs,
        width: manipulated.width,
        height: manipulated.height,
      };
    } catch (e) {
      console.warn('[OCR_PILOT] Image optimization fallback to raw:', e);
      return { ...this.fileInfoFromUri(cleanUri, fallbackName), prepTimeMs: Date.now() - t0 };
    }
  }

  // Single-line Pilot 1 methods
  static async createTrial(
    uri: string, 
    source: 'CAMERA' | 'GALLERY' = 'CAMERA',
    isTestData: boolean = false,
    privacyConfirmed: boolean = true
  ): Promise<OcrTrialResult> {
    const file = await this.prepareOptimizedImage(uri, 'ocr_line.jpg');
    return await postMultipart<OcrTrialResult>(
      '/ocr/trials',
      { key: 'image', uri: file.uri, name: file.name, type: file.type },
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

  // Multi-line Pilot 2 methods with caching, timeout, and metrics logging
  static async detectLines(
    uri: string,
    privacyConfirmed: boolean = true,
    forceRedetect: boolean = false,
    onProgress?: (progress: number, phaseName: string) => void
  ): Promise<MultilineDetectResult> {
    const tStart = Date.now();
    const reqId = 'req_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    console.log(`[OCR_METRICS] OCR_REQUEST_START | reqId=${reqId} | timestamp=${new Date().toISOString()}`);

    // In-memory cache lookup
    if (!forceRedetect && this.detectionCache.has(uri)) {
      console.log(`[OCR_METRICS] CACHE_HIT | reqId=${reqId} | uri=${uri}`);
      onProgress?.(100, 'DONE');
      return this.detectionCache.get(uri)!;
    }

    onProgress?.(15, 'UPLOADING_IMAGE');

    // Step 1: Optimize & resize image
    const file = await this.prepareOptimizedImage(uri, 'page.jpg');
    onProgress?.(30, 'DETECTING_LINES');

    const endpoint = this.getEndpoint('/ocr/multiline/detect');
    console.log('[OCR_PILOT] Requesting detectLines for URI:', uri, '| Endpoint:', endpoint, '| BaseURL:', apiClient.defaults.baseURL);

    // 15 seconds strict timeout
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => {
      console.warn(`[OCR_PILOT] detectLines TIMEOUT after 15s (reqId=${reqId})`);
      controller.abort();
    }, 15000);

    try {
      const result = await postMultipart<MultilineDetectResult>(
        endpoint,
        { key: 'image', uri: file.uri, name: file.name, type: file.type },
        { 
          privacyConfirmed: String(privacyConfirmed),
          forceRedetect: String(forceRedetect),
          _t: Date.now().toString()
        },
        controller.signal
      );
      clearTimeout(timeoutTimer);

      const durationMs = Date.now() - tStart;
      const durationSeconds = (durationMs / 1000).toFixed(2);
      const linesCount = result.lines?.length || 0;

      console.log(`[OCR_METRICS] LINE_DETECTION_DONE | reqId=${reqId} | duration=${durationSeconds}s | lines=${linesCount}`);
      console.log(`[OCR_METRICS] TOTAL_LATENCY | reqId=${reqId} | total=${durationSeconds}s`);

      // Store in memory cache
      this.detectionCache.set(uri, result);
      onProgress?.(100, 'DONE');

      return result;
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      const isTimeout =
        err?.name === 'AbortError' ||
        err?.code === 'ECONNABORTED' ||
        err?.message?.includes('timeout') ||
        (Date.now() - tStart >= 14500);

      if (isTimeout) {
        const timeoutErr = new Error('Quá thời gian chờ máy chủ nhận diện (15 giây).');
        (timeoutErr as any).isTimeout = true;
        (timeoutErr as any).code = 'TIMEOUT';
        throw timeoutErr;
      }

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
      rawOcrConfidenceSource: line.rawOcrConfidenceSource ?? undefined,
      finalText: effectiveFinal || effectiveOcr,
      predictedText: effectiveFinal || effectiveOcr,
      groqSuggestion: line.groqSuggestion ?? undefined,
      groqConfidence: line.groqConfidence ?? undefined,
      groqConfidenceSource: line.groqConfidenceSource ?? undefined,
      groqDecision: line.groqDecision ?? undefined,
      groqStatus: line.groqStatus ?? undefined,
      groqModel: line.groqModel ?? undefined,
      geminiSuggestion: line.geminiSuggestion ?? undefined,
      geminiConfidence: line.geminiConfidence ?? undefined,
      geminiConfidenceSource: line.geminiConfidenceSource ?? undefined,
      geminiDecision: line.geminiDecision ?? undefined,
      geminiStatus: line.geminiStatus ?? undefined,
      geminiModel: line.geminiModel ?? undefined,
      correctedText: line.correctedText ?? undefined,
      correctionApplied: line.correctionApplied ?? undefined,
      correctionDecision: line.correctionDecision ?? undefined,
      suggestions: line.suggestions && line.suggestions.length > 0 ? line.suggestions : undefined,
    };
  }

  static async createMultilineTrial(
    uri: string,
    confirmedLines: LineBox[],
    source: 'CAMERA' | 'GALLERY' = 'CAMERA',
    privacyConfirmed: boolean = true,
    signal?: AbortSignal,
    onProgress?: (progress: number, phaseName: string) => void
  ): Promise<MultilineTrialResult> {
    const tStart = Date.now();
    const reqId = 'req_trial_' + Math.random().toString(36).substring(2, 9);
    console.log(`[OCR_METRICS] OCR_REQUEST_START | reqId=${reqId} | type=createMultilineTrial | timestamp=${new Date().toISOString()}`);

    onProgress?.(20, 'UPLOADING_IMAGE');
    const file = await this.prepareOptimizedImage(uri, 'page.jpg');
    onProgress?.(55, 'OCR_PROCESSING');

    const minimizedLines = confirmedLines.map((l) => this.minimizeLineForTransport(l));
    const endpoint = this.getEndpoint('/ocr/multiline/trials');

    // 30 seconds timeout
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => {
      console.warn(`[OCR_PILOT] createMultilineTrial TIMEOUT after 30s (reqId=${reqId})`);
      controller.abort();
    }, 30000);

    try {
      const combinedSignal = signal || controller.signal;
      const res = await postMultipart<MultilineTrialResult>(
        endpoint,
        { key: 'image', uri: file.uri, name: file.name, type: file.type },
        {
          source,
          privacyConfirmed: String(privacyConfirmed),
          confirmedLines: JSON.stringify(minimizedLines),
        },
        combinedSignal
      );
      clearTimeout(timeoutTimer);

      const totalMs = Date.now() - tStart;
      res.totalLatencyMs = totalMs;
      console.log(`[OCR_METRICS] OCR_DONE | reqId=${reqId} | duration=${(totalMs / 1000).toFixed(2)}s`);
      onProgress?.(85, 'AI_CORRECTION');

      if (res && res.trialId) {
        this.cacheTrial(res);
      }
      onProgress?.(100, 'DONE');
      return res;
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      const isTimeout =
        err?.name === 'AbortError' ||
        err?.code === 'ECONNABORTED' ||
        err?.message?.includes('timeout') ||
        (Date.now() - tStart >= 29500);

      if (isTimeout) {
        const timeoutErr = new Error('Quá thời gian xử lý OCR (30 giây).');
        (timeoutErr as any).isTimeout = true;
        (timeoutErr as any).code = 'TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    }
  }

  static async getMultilineTrial(trialId: string): Promise<MultilineTrialResult> {
    const endpoint = this.getEndpoint(`/ocr/multiline/trials/${trialId}`);
    const response = await apiClient.get<MultilineTrialResult>(endpoint);
    const trial = {
      ...response.data,
      totalLatencyMs: response.data.totalLatencyMs ?? this.getCachedTrial(trialId)?.totalLatencyMs,
    };
    this.cacheTrial(trial);
    return trial;
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
 * Categorizes and formats errors into friendly Vietnamese and English explanations.
 */
export function normalizeOcrError(err: any): { title: string; message: string; isTimeout?: boolean; technical?: string } {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const backendCode = data?.error?.code || data?.code;
  const isTimeout =
    err?.isTimeout ||
    err?.code === 'TIMEOUT' ||
    err?.code === 'ECONNABORTED' ||
    err?.message?.includes('timeout') ||
    err?.name === 'AbortError';

  const technical = `status=${status || 'N/A'}, code=${backendCode || (isTimeout ? 'TIMEOUT' : 'N/A')}, message=${err?.message || 'N/A'}`;

  // 1. Timeout Error
  if (isTimeout) {
    return {
      title: 'Hết thời gian chờ',
      message: 'Nhận diện mất nhiều thời gian hơn dự kiến (quá thời gian chờ). Bạn có muốn thử lại không?',
      isTimeout: true,
      technical,
    };
  }

  // 2. Network Error
  if (err?.message?.includes('Network Error') || err?.message?.includes('Network request failed') || !err?.response) {
    return {
      title: 'Lỗi kết nối OCR server',
      message: 'Không thể kết nối OCR server. Kiểm tra backend hoặc mạng.',
      technical,
    };
  }

  // 3. Server Error (5xx)
  if (status && status >= 500) {
    return {
      title: 'Lỗi máy chủ OCR',
      message: `Máy chủ OCR đang gặp sự cố xử lý (mã lỗi ${status}). Vui lòng thử lại sau ít phút.`,
      technical,
    };
  }

  // 4. AI Processing / Validation Error (4xx)
  if (status === 400 || status === 422) {
    return {
      title: 'Lỗi xử lý ảnh AI',
      message: 'Không thể phân tích ảnh hoặc định dạng ảnh không hợp lệ. Em hãy kiểm tra lại ảnh chụp nhé.',
      technical,
    };
  }

  // 5. Auth error
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
      message: 'Phiên đăng nhập của em đã hết hạn. Vui lòng đăng nhập lại.',
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

  return {
    title: 'Chưa thể nhận diện',
    message: 'Đã có lỗi xảy ra trong quá trình nhận diện. Em hãy thử lại nhé.',
    technical,
  };
}
