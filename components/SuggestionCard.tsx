import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';

// ─── Inline bold parser ───────────────────────────────────────────────────────
// Splits "text **bold** more" into [Text, BoldText, Text] nodes
function InlineText({ text, style }: { text: string; style?: object }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={[style, styles.bold]}>
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

// ─── Line-level renderer ──────────────────────────────────────────────────────
function renderLine(line: string, i: number): React.ReactNode {
  const trimmed = line.trim();
  if (!trimmed) return <View key={i} style={styles.spacer} />;

  // Bullet point: "- text" or "• text"
  if (/^[-•]\s+/.test(trimmed)) {
    const content = trimmed.replace(/^[-•]\s+/, '');
    return (
      <View key={i} style={styles.bulletRow}>
        <Text style={styles.bulletDot}>•</Text>
        <InlineText text={content} style={styles.bulletText} />
      </View>
    );
  }

  // Numbered list: "1. text"
  const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
  if (numberedMatch) {
    return (
      <View key={i} style={styles.bulletRow}>
        <Text style={styles.bulletNum}>{numberedMatch[1]}.</Text>
        <InlineText text={numberedMatch[2]} style={styles.bulletText} />
      </View>
    );
  }

  // URL line (e.g. reference links)
  if (/^https?:\/\//.test(trimmed)) {
    const label = trimmed.replace(/^https?:\/\//, '').split('/')[0];
    return (
      <TouchableOpacity key={i} onPress={() => Linking.openURL(trimmed)} style={styles.urlRow}>
        <Text style={styles.urlText}>↗ {label}</Text>
      </TouchableOpacity>
    );
  }

  // Source citation: "- Label — https://..." or "- Label: https://..."
  const citationMatch = trimmed.match(/^[-•]?\s*(.+?)\s*[—:-]+\s*(https?:\/\/.+)/);
  if (citationMatch) {
    return (
      <TouchableOpacity
        key={i}
        onPress={() => Linking.openURL(citationMatch[2].trim())}
        style={styles.bulletRow}
      >
        <Text style={styles.bulletDot}>↗</Text>
        <Text style={styles.urlText}>{citationMatch[1].trim()}</Text>
      </TouchableOpacity>
    );
  }

  // Regular paragraph
  return <InlineText key={i} text={trimmed} style={styles.paragraph} />;
}

// ─── Section model ────────────────────────────────────────────────────────────
export interface Section {
  header: string | null;
  isReferences: boolean;
  lines: string[];
}

export function parseMarkdownIntoSections(markdown: string): Section[] {
  const rawLines = markdown.split('\n');
  const sections: Section[] = [];
  let current: Section = { header: null, isReferences: false, lines: [] };

  for (const line of rawLines) {
    const trimmed = line.trim();

    // Markdown heading: ## Heading or ### Heading
    const mdHeadingMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if (mdHeadingMatch) {
      if (current.lines.length > 0 || current.header !== null) sections.push(current);
      const heading = mdHeadingMatch[1].replace(/\*\*/g, '');
      current = {
        header: heading,
        isReferences: /references|sources/i.test(heading),
        lines: [],
      };
      continue;
    }

    // Bold-only line used as a section header: **Heading**
    const boldHeadingMatch = trimmed.match(/^\*\*([^*]+)\*\*$/);
    if (boldHeadingMatch) {
      if (current.lines.length > 0 || current.header !== null) sections.push(current);
      const heading = boldHeadingMatch[1];
      current = {
        header: heading,
        isReferences: /references|sources/i.test(heading),
        lines: [],
      };
      continue;
    }

    current.lines.push(line);
  }

  if (current.lines.length > 0 || current.header !== null) sections.push(current);

  // Filter out sections that are entirely empty
  return sections.filter((s) => s.header || s.lines.some((l) => l.trim()));
}

// ─── Card colour palette ──────────────────────────────────────────────────────
const CARD_COLORS = [
  Colors.accent2 + 'CC',
  Colors.accent3 + '88',
  Colors.accent1 + '99',
  Colors.secondary + '33',
];
const CARD_BORDER_COLORS = [Colors.secondary, Colors.accent3, Colors.accent1, Colors.secondary];

// ─── Single section card ──────────────────────────────────────────────────────
function SectionCard({ section, index }: { section: Section; index: number }) {
  const bg = section.isReferences ? '#EAF6FF' : CARD_COLORS[index % CARD_COLORS.length];
  const border = section.isReferences ? Colors.secondary : CARD_BORDER_COLORS[index % CARD_BORDER_COLORS.length];

  const bodyLines = section.lines.filter((l, i, arr) => {
    // Remove leading/trailing blank lines
    if (!l.trim() && (i === 0 || i === arr.length - 1)) return false;
    return true;
  });

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
      {section.header ? (
        <Text style={[styles.cardHeader, section.isReferences && styles.cardHeaderRef]}>
          {section.header}
        </Text>
      ) : null}
      {bodyLines.map((line, i) => renderLine(line, i))}
    </View>
  );
}

// ─── Public display component ─────────────────────────────────────────────────
export function SuggestionsDisplay({ markdown }: { markdown: string }) {
  const sections = parseMarkdownIntoSections(markdown);

  if (sections.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: CARD_COLORS[0], borderColor: CARD_BORDER_COLORS[0] }]}>
        <InlineText text={markdown} style={styles.paragraph} />
      </View>
    );
  }

  return (
    <>
      {sections.map((section, i) => (
        <SectionCard key={i} section={section} index={i} />
      ))}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    gap: 4,
  },
  cardHeader: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
    color: Colors.text,
    marginBottom: 8,
    lineHeight: 22,
  },
  cardHeaderRef: {
    color: Colors.secondary,
  },
  bold: {
    fontFamily: 'Nunito_700Bold',
  },
  paragraph: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 2,
  },
  bulletDot: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 22,
    width: 14,
  },
  bulletNum: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 22,
    width: 20,
  },
  bulletText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
    flex: 1,
  },
  spacer: { height: 6 },
  urlRow: { marginVertical: 2 },
  urlText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.secondary,
    textDecorationLine: 'underline',
    lineHeight: 22,
  },
});
