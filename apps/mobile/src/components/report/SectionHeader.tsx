import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

export interface SectionHeaderProps {
  label: string;
  title: string;
  subtitle?: string;
  description?: string;
  labelColor?: string;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  testID?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  label,
  title,
  subtitle,
  description,
  labelColor = '#64748B',
  rightElement,
  style,
  titleStyle,
  testID,
}) => {
  const displayDesc = description || subtitle;

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.topRow}>
        <View style={styles.textContainer}>
          <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
          <Text style={[styles.title, titleStyle]}>{title}</Text>
        </View>
        {rightElement ? <View style={styles.rightWrapper}>{rightElement}</View> : null}
      </View>
      {displayDesc ? <Text style={styles.description}>“{displayDesc}”</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
    lineHeight: 23,
  },
  description: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginTop: 4,
    fontWeight: '500',
  },
  rightWrapper: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 2,
  },
});

export default SectionHeader;
