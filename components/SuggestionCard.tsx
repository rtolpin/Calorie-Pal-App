import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';

interface SuggestionCardProps {
  text: string;
  index: number;
}

const CARD_COLORS = [
  Colors.accent2,
  Colors.accent3 + 'AA',
  Colors.accent1 + 'AA',
  Colors.secondary + 'AA',
];

const CARD_BORDER_COLORS = [
  Colors.secondary,
  Colors.accent3,
  Colors.accent1,
  Colors.secondary,
];

export function SuggestionCard({ text, index }: SuggestionCardProps) {
  const bg = CARD_COLORS[index % CARD_COLORS.length];
  const border = CARD_BORDER_COLORS[index % CARD_BORDER_COLORS.length];

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

export function SuggestionsDisplay({ markdown }: { markdown: string }) {
  const sections = markdown
    .split(/\n(?=#{1,3} |\*\*[^*]+\*\*\n)/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sections.length === 0) {
    return (
      <SuggestionCard text={markdown} index={0} />
    );
  }

  return (
    <>
      {sections.map((section, i) => (
        <SuggestionCard key={i} text={section} index={i} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  text: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
});
