import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { ImageDraft } from '../draft/submissionDraftStore';

/**
 * Normalizes local file URIs safely.
 * - Guarantees file:// scheme
 * - NEVER runs decodeURIComponent() or decodeURI() on file:// paths
 * - Preserves literal percent-encoded Expo ExperienceData paths (%2540 / %40)
 */
export function normalizeLocalFileUri(uri: string): string {
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
  // Keep file:// URI unchanged — never decode existing Expo cache / ExperienceData URI
  return clean;
}

export const normalizeFileUri = normalizeLocalFileUri;
export const ensureFileUri = normalizeLocalFileUri;

/**
 * Validates local file existence via FileSystem.getInfoAsync and copies to cache directory if missing.
 * Logs [CROP_DEBUG] diagnostic details.
 */
export async function resolveSafeCropImage(
  inputUri: string,
  candidateFallbacks: (string | undefined)[] = []
): Promise<{
  originalUri: string;
  normalizedUri: string;
  exists: boolean;
  finalUri: string;
}> {
  const originalUri = inputUri || '';
  const normalizedUri = normalizeLocalFileUri(originalUri);

  // On Web or if empty URI, bypass native FileSystem checks
  if (Platform.OS === 'web' || !normalizedUri) {
    const exists = !!normalizedUri;
    const finalUri = normalizedUri;
    console.log(
      `[CROP_DEBUG]\noriginalUri=${originalUri}\nnormalizedUri=${normalizedUri}\nexists=${exists}\nfinalUri=${finalUri}`
    );
    return { originalUri, normalizedUri, exists, finalUri };
  }

  // 1. Check primary normalized URI
  let exists = false;
  try {
    const info = await FileSystem.getInfoAsync(normalizedUri);
    exists = !!info.exists;
  } catch {
    exists = false;
  }

  if (exists) {
    const finalUri = normalizedUri;
    console.log(
      `[CROP_DEBUG]\noriginalUri=${originalUri}\nnormalizedUri=${normalizedUri}\nexists=${exists}\nfinalUri=${finalUri}`
    );
    return { originalUri, normalizedUri, exists, finalUri };
  }

  // 2. If primary doesn't exist, test candidate alternatives and path variations
  const pool = new Set<string>();
  candidateFallbacks.forEach((u) => {
    if (u && typeof u === 'string') pool.add(normalizeLocalFileUri(u));
  });

  const addVariations = (base: string) => {
    if (!base) return;
    // Android Expo Go ExperienceData variations
    if (base.includes('@anonymous')) {
      pool.add(base.replace(/@anonymous/g, '%40anonymous').replace(/\/hand-ai/g, '%2Fhand-ai'));
      pool.add(base.replace(/@anonymous/g, '%2540anonymous').replace(/\/hand-ai/g, '%252Fhand-ai'));
    }
    if (base.includes('%40')) {
      pool.add(base.replace(/%40/g, '%2540').replace(/%2F/g, '%252F'));
      pool.add(base.replace(/%40/g, '@'));
    }
    if (base.includes('%2540')) {
      pool.add(base.replace(/%2540/g, '%40').replace(/%252F/g, '%2F'));
      pool.add(base.replace(/%2540/g, '@'));
    }
  };

  addVariations(normalizedUri);
  candidateFallbacks.forEach((u) => u && addVariations(u));

  let workingSourceUri: string | null = null;
  for (const candidate of pool) {
    if (!candidate || candidate === normalizedUri) continue;
    try {
      const info = await FileSystem.getInfoAsync(candidate);
      if (info.exists) {
        workingSourceUri = candidate;
        break;
      }
    } catch {
      // continue scanning
    }
  }

  // 3. If image path does not exist (or alternate source was found), copy to FileSystem.cacheDirectory
  let finalUri = normalizedUri;
  const sourceToCopy = workingSourceUri || (normalizedUri.startsWith('content://') ? normalizedUri : null);

  if (sourceToCopy) {
    try {
      const destFilename = `handai_crop_${Date.now()}.jpg`;
      const cacheDir = FileSystem.cacheDirectory || '';
      const destUri = `${cacheDir}${destFilename}`;
      await FileSystem.copyAsync({ from: sourceToCopy, to: destUri });
      const verify = await FileSystem.getInfoAsync(destUri);
      if (verify.exists) {
        exists = true;
        finalUri = destUri;
      }
    } catch (copyErr) {
      console.warn('[CROP_DEBUG] Failed to copy image to cacheDirectory:', copyErr);
      if (workingSourceUri) {
        exists = true;
        finalUri = workingSourceUri;
      }
    }
  }

  console.log(
    `[CROP_DEBUG]\noriginalUri=${originalUri}\nnormalizedUri=${normalizedUri}\nexists=${exists}\nfinalUri=${finalUri}`
  );
  return { originalUri, normalizedUri, exists, finalUri };
}

export function logStageDiagnostic(
  stage:
    | 'ACQUIRE_CAMERA'
    | 'ACQUIRE_GALLERY'
    | 'NORMALIZED'
    | 'PRIVACY_INPUT'
    | 'PRIVACY_OUTPUT'
    | 'PREVIEW_INPUT'
    | 'CROP_INPUT'
    | 'CROP_OUTPUT'
    | 'PROCESSING_INPUT'
    | 'MULTIPART_READY'
    | 'UPLOAD_RESPONSE'
    | 'TERMINAL_STATUS',
  meta: {
    uri?: string;
    width?: number;
    height?: number;
    mimeType?: string;
    source?: 'CAMERA' | 'GALLERY' | string;
    extra?: string;
  }
): void {
  const scheme = meta.uri ? (meta.uri.match(/^(\w+):\/\//) || ['unknown:'])[0] : 'none';
  const tail = meta.uri ? meta.uri.split('/').pop()?.split('?')[0] : 'none';
  console.log(
    `[DEV_STAGE][${stage}] scheme=${scheme} file=${tail} WxH=${meta.width ?? '?' }x${meta.height ?? '?'} mime=${meta.mimeType || 'n/a'} src=${meta.source || 'n/a'} ${meta.extra ? `(${meta.extra})` : ''}`
  );
}

export async function normalizeImageDraft(
  inputUri: string,
  knownWidth?: number,
  knownHeight?: number,
  source?: 'CAMERA' | 'GALLERY'
): Promise<ImageDraft> {
  const cleanUri = Array.isArray(inputUri) ? inputUri[0] : inputUri;
  if (!cleanUri || typeof cleanUri !== 'string') {
    throw new Error('INVALID_IMAGE_URI: Provided URI is empty or not a valid string.');
  }

  // Ensure URI has proper scheme before manipulation
  const preparedUri = ensureFileUri(cleanUri);

  try {
    // Materialize into a stable, non-transient JPEG file in app cache and normalize EXIF orientation
    const manipResult = await ImageManipulator.manipulateAsync(
      preparedUri,
      [], // no transformations; this acts as a materialize & orientation pass
      { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
    );

    const stableUri = ensureFileUri(manipResult.uri);
    const resolvedWidth = manipResult.width || knownWidth || 0;
    const resolvedHeight = manipResult.height || knownHeight || 0;

    const filename = `mathvision_${Date.now()}.jpg`;
    const imageSessionId = `session_${Date.now()}`;

    const draft: ImageDraft = {
      imageSessionId,
      sourceImageUri: stableUri,
      rawUri: cleanUri,
      uri: stableUri,
      width: resolvedWidth,
      height: resolvedHeight,
      mimeType: 'image/jpeg',
      filename,
      source: source || 'CAMERA',
      isMasked: false,
    };

    logStageDiagnostic('NORMALIZED', {
      uri: stableUri,
      width: resolvedWidth,
      height: resolvedHeight,
      mimeType: 'image/jpeg',
      source: draft.source,
    });

    return draft;
  } catch (err) {
    console.warn('[IMAGE_PIPELINE] manipulateAsync fallback used:', err);
    // If manipulateAsync throws (e.g. on web or unsupported mock), fall back gracefully
    const stableUri = ensureFileUri(cleanUri);
    const imageSessionId = `session_${Date.now()}`;
    const draft: ImageDraft = {
      imageSessionId,
      sourceImageUri: stableUri,
      rawUri: cleanUri,
      uri: stableUri,
      width: knownWidth || 0,
      height: knownHeight || 0,
      mimeType: 'image/jpeg',
      filename: `mathvision_${Date.now()}.jpg`,
      source: source || 'CAMERA',
      isMasked: false,
    };

    logStageDiagnostic('NORMALIZED', {
      uri: stableUri,
      width: draft.width,
      height: draft.height,
      mimeType: 'image/jpeg',
      source: draft.source,
      extra: 'fallback',
    });

    return draft;
  }
}
