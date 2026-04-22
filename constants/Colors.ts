export const Colors = {
  // Brand
  primary: '#FF6B35',
  secondary: '#4ECDC4',
  accent1: '#FFE66D',
  accent2: '#A8E6CF',
  accent3: '#FF8B94',

  // Backgrounds
  background: '#F8F9FA',
  darkBackground: '#1A1A2E',
  surface: '#FFFFFF',
  surfaceDark: '#2D2D44',

  // Macros (consistent throughout app)
  protein: '#4A90E2',
  carbs: '#FF6B35',
  fat: '#E6A817',
  fiber: '#27AE60',
  sugar: '#FF8B94',
  sodium: '#B2BEC3',

  // Text
  text: '#2D3436',
  textLight: '#636E72',
  textMuted: '#B2BEC3',
  textWhite: '#FFFFFF',

  // Status
  success: '#00B894',
  error: '#E17055',
  warning: '#FDCB6E',

  // Borders
  border: '#DFE6E9',
  borderLight: '#F1F3F4',

  // Gradients (used as array pairs)
  gradientOrangeYellow: ['#FF6B35', '#FFE66D'] as const,
  gradientTealMint: ['#4ECDC4', '#A8E6CF'] as const,
  gradientPinkOrange: ['#FF8B94', '#FF6B35'] as const,
};

export const MacroColors = {
  protein: { color: Colors.protein, emoji: '💪', label: 'Protein' },
  carbs: { color: Colors.carbs, emoji: '🌾', label: 'Carbs' },
  fat: { color: Colors.fat, emoji: '🥑', label: 'Fat' },
  fiber: { color: Colors.fiber, emoji: '🥦', label: 'Fiber' },
  sugar: { color: Colors.sugar, emoji: '🍬', label: 'Sugar' },
  sodium: { color: Colors.sodium, emoji: '🧂', label: 'Sodium' },
};
