import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface DetectedErrorItem {
  id: string;
  errorType: string;
  name?: string;
  originalText?: string;
  suggestedText?: string;
  characterSnippet?: string;
  charFrom?: string;
  charTo?: string;
  explanation?: string;
  color?: string;
  // Legacy backward-compatibility fields
  percentage?: number | string;
  example?: string;
}

export interface ErrorInsightCardProps {
  title?: string;
  subtitle?: string;
  rawText?: string;
  aiSuggestedText?: string;
  /**
   * Error items detected in the CURRENT recognition result.
   * If empty or undefined → shows "No recognition issues detected".
   * Must be driven from actual recognition data, never from defaults.
   */
  errors?: DetectedErrorItem[];
  /** Legacy prop for backward-compatibility with earlier unit tests */
  categories?: DetectedErrorItem[];
  style?: ViewStyle;
  testID?: string;
}

/**
 * ErrorInsightCard — Data-Driven Recognition Error Display.
 *
 * RULES:
 * - Only shows errors that were actually detected in the current image.
 * - If no errors: displays "No recognition issues detected".
 * - Never generates fake percentages or default error categories.
 * - Fully driven by the `errors` prop from recognition result data.
 */
export const ErrorInsightCard: React.FC<ErrorInsightCardProps> = ({
  title = 'Recognition Error Insights',
  subtitle,
  errors,
  categories,
  style,
  testID,
}) => {
  // Use explicit errors > categories (legacy) > empty
  const displayErrors: DetectedErrorItem[] = errors && errors.length > 0
    ? errors
    : categories && categories.length > 0
      ? categories
      : [];

  const hasErrors = displayErrors.length > 0;

  // Dynamic subtitle based on actual state
  const displaySubtitle = subtitle ||
    (hasErrors
      ? `${displayErrors.length} issue${displayErrors.length > 1 ? 's' : ''} detected in current recognition`
      : 'Recognition analysis complete');

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, !hasErrors && styles.iconWrapClean]}>
          <Ionicons
            name={hasErrors ? 'scan-circle-outline' : 'checkmark-circle'}
            size={18}
            color={hasErrors ? '#B45309' : '#059669'}
          />
        </View>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.titleText}>{title}</Text>
          <Text style={styles.subtitleText}>{displaySubtitle}</Text>
        </View>
        {hasErrors ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{`${displayErrors.length} Detected`}</Text>
          </View>
        ) : null}
      </View>

      {/* Content */}
      {!hasErrors ? (
        /* ====== CLEAN STATE: No errors ====== */
        <View style={styles.cleanBox}>
          <Ionicons name="checkmark-circle" size={28} color="#059669" />
          <Text style={styles.cleanTitle}>No recognition issues detected</Text>
          <Text style={styles.cleanSub}>
            All characters and tones matched correctly in this recognition result.
          </Text>
        </View>
      ) : (
        /* ====== ERROR LIST: Actual detected issues ====== */
        <View style={styles.errorsList}>
          {displayErrors.map((err, index) => {
            const itemColor = err.color || '#DC2626';

            return (
              <View
                key={err.id || index}
                style={[styles.errorCard, index === displayErrors.length - 1 && styles.lastCard]}
              >
                {/* Error type header */}
                <View style={styles.cardTopRow}>
                  <View style={styles.typeBadgeRow}>
                    <View style={[styles.indicatorDot, { backgroundColor: itemColor }]} />
                    <Text style={styles.errorTypeName}>{err.errorType || err.name}</Text>
                  </View>
                </View>

                {/* Phrase-level comparison: Original vs Suggested */}
                {err.originalText && err.suggestedText ? (
                  <View style={styles.transformationBox}>
                    <View style={styles.transformRow}>
                      <Text style={styles.fieldLabel}>Original:</Text>
                      <View style={styles.rawTextChip}>
                        <Text style={styles.rawTextContent}>{err.originalText}</Text>
                      </View>
                    </View>
                    <View style={styles.arrowRow}>
                      <Ionicons name="arrow-down" size={13} color="#94A3B8" />
                    </View>
                    <View style={styles.transformRow}>
                      <Text style={[styles.fieldLabel, { color: '#6D28D9' }]}>Suggested:</Text>
                      <View style={styles.aiTextChip}>
                        <Text style={styles.aiTextContent}>{err.suggestedText}</Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {/* Character-level comparison */}
                {(err.characterSnippet || (err.charFrom && err.charTo)) ? (
                  <View style={styles.charSnippetBox}>
                    <Text style={styles.charLabel}>Character:</Text>
                    <View style={styles.charPill}>
                      <Text style={styles.charPillText}>
                        {err.characterSnippet || `${err.charFrom} → ${err.charTo}`}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Explanation */}
                {err.explanation ? (
                  <Text style={styles.explanationText}>{err.explanation}</Text>
                ) : null}

                {/* Legacy example support */}
                {err.example && !err.characterSnippet && !err.originalText ? (
                  <View style={styles.charSnippetBox}>
                    <Text style={styles.charLabel}>Example:</Text>
                    <Text style={styles.legacyExampleText}>{err.example}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconWrapClean: {
    backgroundColor: '#ECFDF5',
  },
  headerTitleWrap: {
    flex: 1,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  countBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },

  // Clean state
  cleanBox: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  cleanTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
    marginTop: 8,
  },
  cleanSub: {
    fontSize: 12,
    color: '#047857',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  // Error cards
  errorsList: {
    gap: 12,
  },
  errorCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  lastCard: {
    marginBottom: 0,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  errorTypeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  transformationBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 10,
  },
  transformRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowRow: {
    paddingLeft: 56,
    marginVertical: 2,
  },
  fieldLabel: {
    width: 68,
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  rawTextChip: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rawTextContent: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    fontFamily: 'monospace',
  },
  aiTextChip: {
    flex: 1,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aiTextContent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
    fontFamily: 'monospace',
  },
  charSnippetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  charLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginRight: 8,
  },
  charPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  charPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  legacyExampleText: {
    fontSize: 12,
    color: '#475569',
  },
  explanationText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
});
