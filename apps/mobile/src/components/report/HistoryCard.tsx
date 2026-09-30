import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatMetricPercent, formatSeconds } from '../../utils/metricFormat';

export interface HistoryCardProps {
  sessionId: string;
  formattedSessionId?: string;
  date?: string;
  time?: string;
  timestamp?: number | string;
  duration?: string | number;
  imageThumbnailUri?: string;

  // Primary: Recognition result text
  detectedText?: string;

  // Recognition pipeline
  rawOcrPreview?: string;
  aiSuggestionPreview?: string;
  verifiedResultPreview?: string;
  confidence?: number | string;

  // Secondary metadata (collapsed by default)
  modelVersion?: string;
  rawOcrAccuracy?: number | string;
  aiImprovement?: number | string;
  improvementLabel?: string;
  sampleCount?: string | number;
  status?: string;
  benchmarkBadge?: string;
  isSampleData?: boolean;

  onPress: () => void;
  style?: ViewStyle;
  testID?: string;
}

/**
 * HistoryCard — Recognition Lookup Card.
 * Purpose: "Previous recognition lookup" — NOT benchmark/session logs.
 *
 * Priority order:
 * 1. Original handwritten image thumbnail (large)
 * 2. Recognition timestamp
 * 3. Detected text result (primary)
 * 4. Recognition pipeline: Raw OCR → AI Suggestion → Verified
 * 5. Confidence score
 * 6. Benchmark metadata (model, duration, AI improvement) — secondary, collapsed
 */
export const HistoryCard: React.FC<HistoryCardProps> = ({
  sessionId,
  formattedSessionId,
  date,
  time,
  timestamp,
  duration,
  imageThumbnailUri,
  detectedText,
  rawOcrPreview,
  aiSuggestionPreview,
  verifiedResultPreview,
  confidence,
  modelVersion,
  rawOcrAccuracy,
  aiImprovement,
  improvementLabel = 'AI Gain',
  sampleCount,
  status = 'COMPLETED',
  benchmarkBadge,
  isSampleData = false,
  onPress,
  style,
  testID,
}) => {
  const [showMeta, setShowMeta] = useState(false);

  const formattedConfidence = confidence == null || confidence === ''
    ? null
    : formatMetricPercent(confidence);
  const formattedDuration = duration == null || duration === ''
    ? null
    : formatSeconds(duration, '—');

  // Determine final recognized text to display prominently
  const primaryText = detectedText || verifiedResultPreview || aiSuggestionPreview || rawOcrPreview || '';

  // Format date/time
  const displayDateTime = timestamp
    ? typeof timestamp === 'number'
      ? `${new Date(timestamp).toLocaleDateString('vi-VN')} ${new Date(timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
      : String(timestamp)
    : [date, time].filter(Boolean).join(' ');

  const hasPipeline = Boolean(rawOcrPreview || aiSuggestionPreview || verifiedResultPreview);

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={displayDateTime
        ? `View recognition result from ${displayDateTime}`
        : 'View recognition result'}
      testID={testID}
    >
      {/* ===== ROW 1: Image Thumbnail + Primary Result ===== */}
      <View style={styles.mainRow}>
        {/* Large Image Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {imageThumbnailUri ? (
            <Image source={{ uri: imageThumbnailUri }} style={styles.thumbnailImage} resizeMode="cover" />
          ) : (
            <View style={styles.thumbnailMock}>
              <Ionicons name="image-outline" size={22} color="#94A3B8" />
              <Text style={styles.thumbnailEmptyText}>No image</Text>
            </View>
          )}
        </View>

        {/* Right Column: 2. Recognized text, 3. Confidence, 4. Timestamp */}
        <View style={styles.primaryColumn}>
          {/* Top: Recognition Entry Badge + Chevron */}
          <View style={styles.entryHeaderRow}>
            {(formattedSessionId || sessionId) ? (
              <View style={styles.sessionBadge}>
                <Text style={styles.sessionBadgeText}>{formattedSessionId || sessionId}</Text>
              </View>
            ) : null}
            {isSampleData ? (
              <View style={styles.sampleDataBadge}>
                <Text style={styles.sampleDataBadgeText}>Sample Data</Text>
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={14} color="#CBD5E1" style={{ marginLeft: 'auto' }} />
          </View>

          {/* 2. Recognized text result — Primary */}
          <Text style={styles.detectedTextResult} numberOfLines={2}>
            {primaryText ? `"${primaryText}"` : 'No stored recognition result'}
          </Text>

          {/* 3 & 4. Confidence Score + Timestamp */}
          <View style={styles.metaLineRow}>
            {/* 3. Confidence */}
            {formattedConfidence ? (
              <View style={styles.confidencePill}>
                <Ionicons name="shield-checkmark-outline" size={11} color="#047857" style={{ marginRight: 3 }} />
                <Text style={styles.confidenceText}>{formattedConfidence}</Text>
              </View>
            ) : null}

            {/* 4. Timestamp & Duration */}
            {displayDateTime || formattedDuration ? (
              <View style={styles.timestampWrap}>
                <Ionicons name="time-outline" size={11} color="#64748B" style={{ marginRight: 3 }} />
                {displayDateTime ? <Text style={styles.timestampText}>{displayDateTime}</Text> : null}
                {formattedDuration ? (
                  <Text style={styles.durationSmall}>{displayDateTime ? ' · ' : ''}{formattedDuration}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* ===== ROW 2: Recognition Pipeline (Raw → AI → Verified) ===== */}
      {hasPipeline ? <View style={styles.pipelineSection}>
        {/* Raw OCR */}
        {rawOcrPreview ? <View style={styles.pipelineStep}>
          <View style={[styles.stepDot, { backgroundColor: '#DC2626' }]} />
          <Text style={styles.stepLabel}>Raw OCR</Text>
          <Text style={styles.stepText} numberOfLines={1}>"{rawOcrPreview}"</Text>
        </View> : null}

        {/* AI Suggestion */}
        {aiSuggestionPreview ? <View style={styles.pipelineStep}>
          <View style={[styles.stepDot, { backgroundColor: '#7C3AED' }]} />
          <Text style={[styles.stepLabel, { color: '#6D28D9' }]}>AI Suggestion</Text>
          <Text style={[styles.stepText, { color: '#7C3AED', fontWeight: '600' }]} numberOfLines={1}>
            "{aiSuggestionPreview}"
          </Text>
        </View> : null}

        {/* Verified Result (if available) */}
        {verifiedResultPreview ? (
          <View style={styles.pipelineStep}>
            <View style={[styles.stepDot, { backgroundColor: '#059669' }]} />
            <Text style={[styles.stepLabel, { color: '#047857' }]}>Final result</Text>
            <Text style={[styles.stepText, { color: '#047857', fontWeight: '700' }]} numberOfLines={1}>
              "{verifiedResultPreview}"
            </Text>
          </View>
        ) : null}
      </View> : null}

      {/* ===== ROW 3: Secondary Metadata (collapsed toggle) ===== */}
      {(rawOcrAccuracy !== undefined || modelVersion) ? (
        <View style={styles.metaSection}>
          <TouchableOpacity
            style={styles.metaToggle}
            onPress={(e) => {
              e.stopPropagation();
              setShowMeta(!showMeta);
            }}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Toggle benchmark details"
          >
            <Text style={styles.metaToggleText}>
              {showMeta ? 'Hide details' : 'Benchmark details'}
            </Text>
            <Ionicons name={showMeta ? 'chevron-up' : 'chevron-down'} size={12} color="#94A3B8" />
          </TouchableOpacity>

          {showMeta ? (
            <View style={styles.metaDetails}>
              {modelVersion ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>Model</Text>
                  <Text style={styles.metaVal}>{modelVersion}</Text>
                </View>
              ) : null}
              {rawOcrAccuracy !== undefined ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>Raw OCR</Text>
                  <Text style={styles.metaVal}>
                    {typeof rawOcrAccuracy === 'number' ? `${rawOcrAccuracy}%` : rawOcrAccuracy}
                  </Text>
                </View>
              ) : null}
              {aiImprovement !== undefined ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>{improvementLabel}</Text>
                  <Text style={[styles.metaVal, { color: '#7C3AED' }]}>
                    {typeof aiImprovement === 'number' ? `+${aiImprovement}%` : aiImprovement}
                  </Text>
                </View>
              ) : null}
              {sampleCount ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>Samples</Text>
                  <Text style={styles.metaVal}>{sampleCount}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
      web: { boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' },
    }),
  },

  // Row 1: Main row — thumbnail + primary result
  mainRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  thumbnailContainer: {
    width: 80,
    height: 80,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    marginRight: 12,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailMock: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FBFDFB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  thumbnailEmptyText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
  },

  primaryColumn: {
    flex: 1,
    justifyContent: 'space-between',
  },
  entryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    marginRight: 6,
  },
  sessionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.2,
  },
  sampleDataBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginRight: 6,
  },
  sampleDataBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.2,
  },
  metaLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    flexWrap: 'wrap',
    gap: 8,
  },
  timestampWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestampText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  detectedTextResult: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
    marginBottom: 6,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },
  durationSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // Row 2: Recognition pipeline
  pipelineSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 10,
    gap: 6,
  },
  pipelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  stepLabel: {
    width: 68,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
  },

  // Row 3: Collapsed metadata
  metaSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
  },
  metaToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  metaToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginRight: 4,
  },
  metaDetails: {
    marginTop: 8,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  metaKey: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  metaVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
});
