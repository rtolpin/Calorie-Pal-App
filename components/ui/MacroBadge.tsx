import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, MacroColors } from '../../constants/Colors';

type MacroKey = 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium';

interface MacroBadgeProps {
  type: MacroKey;
  value: number;
  unit?: string;
  size?: 'sm' | 'md';
}

export function MacroBadge({ type, value, unit = 'g', size = 'md' }: MacroBadgeProps) {
  const { color, emoji, label } = MacroColors[type];
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[styles.emoji, isSmall && styles.emojiSm]}>{emoji}</Text>
      <View>
        <Text style={[styles.label, { color }, isSmall && styles.labelSm]}>{label}</Text>
        <Text style={[styles.value, { color }, isSmall && styles.valueSm]}>
          {Math.round(value)}{unit}
        </Text>
      </View>
    </View>
  );
}

interface MacroCardProps {
  type: MacroKey;
  value: number;
}

function MacroCard({ type, value }: MacroCardProps) {
  const { color, emoji, label } = MacroColors[type];
  return (
    <View style={[styles.card, { backgroundColor: color + '35', borderColor: color + '80' }]}>
      <View style={[styles.cardAccent, { backgroundColor: color }]} />
      <View style={styles.cardBody}>
        <Text style={styles.cardEmoji}>{emoji}</Text>
        <View>
          <Text style={[styles.cardValue, { color }]}>{Math.round(value)}g</Text>
          <Text style={[styles.cardLabel, { color }]}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

export function MacroRow({
  protein,
  carbs,
  fat,
  fiber,
  size = 'md',
}: {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  size?: 'sm' | 'md';
}) {
  if (size === 'sm') {
    return (
      <View style={styles.row}>
        <MacroBadge type="protein" value={protein} size="sm" />
        <MacroBadge type="carbs" value={carbs} size="sm" />
        <MacroBadge type="fat" value={fat} size="sm" />
        <MacroBadge type="fiber" value={fiber} size="sm" />
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      <View style={styles.gridRow}>
        <MacroCard type="protein" value={protein} />
        <MacroCard type="carbs" value={carbs} />
      </View>
      <View style={styles.gridRow}>
        <MacroCard type="fat" value={fat} />
        <MacroCard type="fiber" value={fiber} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Legacy small badge (used in sm size)
  row: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  emoji: { fontSize: 14 },
  emojiSm: { fontSize: 11 },
  value: { fontFamily: 'Nunito_700Bold', fontSize: 13 },
  valueSm: { fontSize: 11 },
  label: { fontFamily: 'Nunito_700Bold', fontSize: 10 },
  labelSm: { fontSize: 9 },

  // Grid card design (used in md size)
  grid: { gap: 10, marginTop: 4 },
  gridRow: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardAccent: { width: 4 },
  cardBody: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardEmoji: { fontSize: 16 },
  cardValue: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
    lineHeight: 20,
  },
  cardLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
  },
});
