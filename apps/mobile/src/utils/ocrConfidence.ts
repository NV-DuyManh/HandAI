/** A model score, not a calibrated probability that a whole line is correct. */
export const OCR_CONFIDENCE_SOURCE = 'CRNN_CTC_SOFTMAX';

export function getRawOcrConfidence(line: {
  rawOcrConfidence?: number | null;
  rawOcrConfidenceSource?: string | null;
}): number | undefined {
  const value = line.rawOcrConfidence;
  return line.rawOcrConfidenceSource === OCR_CONFIDENCE_SOURCE &&
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : undefined;
}

export const OCR_CONFIDENCE_EXPLANATION =
  'This score comes from the OCR model: it averages the peak character probabilities after decoding. It is not calibrated and does not measure whether the whole line is correct. Accuracy requires separate reference text.';
