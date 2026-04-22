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
        <Text style={[styles.value, { color }, isSmall && styles.valueSm]}>
          {Math.round(value)}{unit}
        </Text>
        {!isSmall && <Text style={[styles.label, { color }]}>{label}</Text>}
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
  return (
    <View style={styles.row}>
      <MacroBadge type="protein" value={protein} size={size} />
      <MacroBadge type="carbs" value={carbs} size={size} />
      <MacroBadge type="fat" value={fat} size={size} />
      <MacroBadge type="fiber" value={fiber} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
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
  value: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
  },
  valueSm: { fontSize: 11 },
  label: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
  },
});
