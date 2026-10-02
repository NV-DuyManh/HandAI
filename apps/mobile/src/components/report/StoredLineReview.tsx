import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { handAiAnalyticsStore, type LineMetric } from '../../services/analytics/handAiAnalyticsStore';
import { OCR_CONFIDENCE_EXPLANATION } from '../../utils/ocrConfidence';

const selectedText = (line: LineMetric): string => line.finalResult || line.finalText || line.text || '';

export function StoredLineReview({ line, sessionId }: { line: LineMetric; sessionId: string }) {
  const [editing, setEditing] = useState(false);
  const [finalText, setFinalText] = useState(selectedText(line));
  const [saving, setSaving] = useState(false);
  const reviewed = line.groundTruthStatus === 'EXPLICIT' && line.evaluationStatus === 'EVALUATED';
  const score = line.confidenceSource === 'CRNN_CTC_SOFTMAX' && Number.isFinite(line.confidence)
    && line.confidence >= 0 && line.confidence <= 100 ? line.confidence : null;
  const raw = line.ocrOutput || line.modelOutput || line.ocrText;
  const suggestions = line.aiSuggestions?.length ? line.aiSuggestions : line.aiCandidate || line.aiSuggestion
    ? [{ text: line.aiCandidate || line.aiSuggestion }]
    : [];
  const source = line.decisionSource === 'MANUAL_EDIT' ? 'Manual edit'
    : line.decisionSource === 'AI_CORRECTION' ? 'AI' : 'OCR';

  const saveFinal = async () => {
    if (!finalText.trim()) {
      Alert.alert('Final text is empty', 'Enter the correct text or cancel the edit.');
      return;
    }
    setSaving(true);
    try {
      await handAiAnalyticsStore.reviewFinalText(sessionId, line.lineId, finalText);
      setEditing(false);
    } catch {
      Alert.alert('Final text not saved', 'Please try again.');
    } finally { setSaving(false); }
  };

  return <View style={styles.card} testID={`stored-line-${line.lineId}`}>
    <View style={styles.header}>
      <Text style={styles.line}>LINE {line.lineIndex}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Explain recorded OCR score"
        onPress={() => Alert.alert('OCR score · uncalibrated', OCR_CONFIDENCE_EXPLANATION)}>
        <Text style={styles.score}>{score == null ? 'Score not recorded' : `OCR score ${score}% ⓘ`}</Text>
      </Pressable>
    </View>
    <View style={styles.raw}><Text style={styles.label}>RAW OCR</Text><Text style={styles.text}>{raw || 'Not stored'}</Text></View>
    {suggestions.length ? suggestions.map((suggestion, index) => <View style={styles.ai} key={`${index}-${suggestion.text}`}>
      <Text style={styles.label}>AI CANDIDATE {suggestions.length > 1 ? index + 1 : ''}</Text>
      <Text style={styles.text}>{suggestion.text}</Text>
      {'confidenceSource' in suggestion && suggestion.confidenceSource === 'AI_SELF_REPORTED' && typeof suggestion.confidence === 'number'
        && Number.isFinite(suggestion.confidence) && suggestion.confidence >= 0 && suggestion.confidence <= 1
        ? <Text style={styles.note}>AI self-reported score {(suggestion.confidence * 100).toFixed(1)}% · uncalibrated</Text> : null}
    </View>) : <Text style={styles.note}>No AI response was stored for this line.</Text>}
    <View style={[styles.final, reviewed && styles.finalReviewed]}>
      <View style={styles.finalHeader}>
        <Text style={styles.label}>FINAL TEXT · {source.toUpperCase()}</Text>
        <Text style={[styles.reviewState, reviewed && styles.reviewStateDone]}>{reviewed ? 'REVIEWED' : 'NOT REVIEWED'}</Text>
      </View>
      {editing ? <TextInput accessibilityLabel={`Edit final text for line ${line.lineIndex}`} value={finalText}
        onChangeText={setFinalText} style={styles.input} multiline autoFocus />
        : <Text style={styles.text}>{selectedText(line) || 'Not stored'}</Text>}
    </View>
    <Text style={styles.note}>If this final text matches the handwriting, confirm it. If it is wrong, edit only this line.</Text>
    {editing ? <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Cancel final text edit for line ${line.lineIndex}`}
        style={[styles.actionButton, styles.secondaryButton]} onPress={() => { setFinalText(selectedText(line)); setEditing(false); }}>
        <Text style={styles.secondaryButtonText}>Cancel</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Save and confirm final text for line ${line.lineIndex}`}
        disabled={saving} style={[styles.actionButton, styles.primaryButton, saving && styles.disabled]} onPress={saveFinal}>
        <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save & confirm'}</Text>
      </Pressable>
    </View> : <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit final text for line ${line.lineIndex}`}
        style={[styles.actionButton, styles.secondaryButton]} onPress={() => setEditing(true)}>
        <Text style={styles.secondaryButtonText}>Edit final text</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Confirm final text for line ${line.lineIndex}`}
        disabled={saving || reviewed} style={[styles.actionButton, styles.primaryButton, (saving || reviewed) && styles.disabled]} onPress={saveFinal}>
        <Text style={styles.primaryButtonText}>{reviewed ? 'Reviewed' : saving ? 'Saving…' : 'Confirm correct'}</Text>
      </Pressable>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'white', marginTop: 14, gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  line: { color: '#1D4ED8', fontSize: 14, fontWeight: '800' },
  score: { color: '#475569', fontSize: 12, paddingVertical: 12 },
  label: { color: '#475569', fontSize: 11, fontWeight: '800', marginBottom: 6 },
  text: { color: '#0F172A', fontSize: 18, lineHeight: 26 },
  note: { color: '#64748B', fontSize: 12, lineHeight: 18 },
  raw: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 14 },
  ai: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 12, padding: 14 },
  final: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD', borderWidth: 1, borderRadius: 12, padding: 14 },
  finalReviewed: { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' },
  finalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  reviewState: { color: '#B45309', backgroundColor: '#FEF3C7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '800' },
  reviewStateDone: { color: '#047857', backgroundColor: '#D1FAE5' },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, minHeight: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  primaryButton: { backgroundColor: '#1D4ED8' },
  secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#93C5FD' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  secondaryButtonText: { color: '#1D4ED8', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.55 },
  input: { borderWidth: 1, borderColor: '#60A5FA', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, color: '#0F172A', fontSize: 18, lineHeight: 26, marginTop: 4 },
});
