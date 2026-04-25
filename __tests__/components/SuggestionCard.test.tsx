import { parseMarkdownIntoSections, Section } from '../../components/SuggestionCard';

// ─── parseMarkdownIntoSections ────────────────────────────────────────────────

describe('parseMarkdownIntoSections — empty / trivial input', () => {
  it('returns an empty array for an empty string', () => {
    expect(parseMarkdownIntoSections('')).toEqual([]);
  });

  it('returns an empty array for a whitespace-only string', () => {
    expect(parseMarkdownIntoSections('   \n\n   ')).toEqual([]);
  });

  it('returns one header-less section for plain text with no headings', () => {
    const result = parseMarkdownIntoSections('You are doing great!');
    expect(result).toHaveLength(1);
    expect(result[0].header).toBeNull();
    expect(result[0].lines).toContain('You are doing great!');
  });
});

describe('parseMarkdownIntoSections — bold headers (**Header**)', () => {
  it('parses a single **bold** header into a section', () => {
    const md = '**Overall Assessment**\nYou are doing well.';
    const result = parseMarkdownIntoSections(md);
    expect(result).toHaveLength(1);
    expect(result[0].header).toBe('Overall Assessment');
    expect(result[0].lines).toContain('You are doing well.');
  });

  it('strips surrounding ** from the header text', () => {
    const result = parseMarkdownIntoSections('**My Section**\nContent here.');
    expect(result[0].header).toBe('My Section');
    expect(result[0].header).not.toContain('**');
  });

  it('parses multiple bold headers into separate sections', () => {
    const md = `**Section One**\nFirst content.\n\n**Section Two**\nSecond content.`;
    const result = parseMarkdownIntoSections(md);
    expect(result).toHaveLength(2);
    expect(result[0].header).toBe('Section One');
    expect(result[1].header).toBe('Section Two');
  });

  it('keeps body lines under the correct section', () => {
    const md = `**A**\nLine A1\nLine A2\n\n**B**\nLine B1`;
    const result = parseMarkdownIntoSections(md);
    expect(result[0].lines.some((l) => l.includes('Line A1'))).toBe(true);
    expect(result[0].lines.some((l) => l.includes('Line B1'))).toBe(false);
    expect(result[1].lines.some((l) => l.includes('Line B1'))).toBe(true);
  });

  it('body lines with inline ** bold markers are NOT treated as headers', () => {
    const md = '**Header**\nThis has **bold** inline text.';
    const result = parseMarkdownIntoSections(md);
    expect(result).toHaveLength(1);
    expect(result[0].lines.some((l) => l.includes('**bold**'))).toBe(true);
  });
});

describe('parseMarkdownIntoSections — markdown headings (## Heading)', () => {
  it('parses ## headings into sections', () => {
    const md = '## Overall Assessment\nYou are doing well.';
    const result = parseMarkdownIntoSections(md);
    expect(result).toHaveLength(1);
    expect(result[0].header).toBe('Overall Assessment');
  });

  it('parses ### headings into sections', () => {
    const md = '### Sub-section\nContent here.';
    const result = parseMarkdownIntoSections(md);
    expect(result[0].header).toBe('Sub-section');
  });

  it('strips ** from ## headings that contain bold markers', () => {
    const md = '## **Bold Heading**\nContent.';
    const result = parseMarkdownIntoSections(md);
    expect(result[0].header).toBe('Bold Heading');
    expect(result[0].header).not.toContain('**');
  });

  it('parses multiple ## headings into separate sections', () => {
    const md = '## Section A\nA content.\n\n## Section B\nB content.';
    const result = parseMarkdownIntoSections(md);
    expect(result).toHaveLength(2);
    expect(result[0].header).toBe('Section A');
    expect(result[1].header).toBe('Section B');
  });
});

describe('parseMarkdownIntoSections — References / Sources detection', () => {
  it('marks a section called "📚 References" as isReferences', () => {
    const md = '**📚 References**\n- USDA https://www.dietaryguidelines.gov';
    const result = parseMarkdownIntoSections(md);
    expect(result[0].isReferences).toBe(true);
  });

  it('marks a section called "Sources" as isReferences', () => {
    const md = '**Sources**\n- NIH https://www.nih.gov';
    const result = parseMarkdownIntoSections(md);
    expect(result[0].isReferences).toBe(true);
  });

  it('marks a section called "references" (lowercase) as isReferences', () => {
    const md = '## references\nContent.';
    const result = parseMarkdownIntoSections(md);
    expect(result[0].isReferences).toBe(true);
  });

  it('does NOT mark an unrelated section as isReferences', () => {
    const md = '**Overall Assessment**\nContent here.';
    const result = parseMarkdownIntoSections(md);
    expect(result[0].isReferences).toBe(false);
  });

  it('isReferences is false for all non-reference sections in a multi-section document', () => {
    const md = `**Suggestions**\nEat more protein.\n\n**📚 References**\n- NIH`;
    const result = parseMarkdownIntoSections(md);
    expect(result[0].isReferences).toBe(false);
    expect(result[1].isReferences).toBe(true);
  });
});

describe('parseMarkdownIntoSections — line content preservation', () => {
  it('preserves bullet point lines as raw strings', () => {
    const md = '**Tips**\n- Drink more water\n- Eat more protein';
    const result = parseMarkdownIntoSections(md);
    expect(result[0].lines.some((l) => l.includes('- Drink more water'))).toBe(true);
    expect(result[0].lines.some((l) => l.includes('- Eat more protein'))).toBe(true);
  });

  it('preserves numbered list lines', () => {
    const md = '**Steps**\n1. First step\n2. Second step';
    const result = parseMarkdownIntoSections(md);
    expect(result[0].lines.some((l) => l.includes('1. First step'))).toBe(true);
    expect(result[0].lines.some((l) => l.includes('2. Second step'))).toBe(true);
  });

  it('preserves blank lines as empty strings within body', () => {
    const md = '**Header**\nFirst paragraph.\n\nSecond paragraph.';
    const result = parseMarkdownIntoSections(md);
    expect(result[0].lines.some((l) => l.trim() === '')).toBe(true);
  });

  it('preserves URL lines for reference rendering', () => {
    const md = '**References**\n- USDA — https://www.dietaryguidelines.gov';
    const result = parseMarkdownIntoSections(md);
    expect(result[0].lines.some((l) => l.includes('https://www.dietaryguidelines.gov'))).toBe(true);
  });
});

describe('parseMarkdownIntoSections — empty section filtering', () => {
  it('keeps a section that has a header even if body is blank lines', () => {
    // A section is only filtered when it has NO header AND NO content — a header alone suffices.
    const md = '**EmptyHeader**\n\n\n**RealHeader**\nActual content.';
    const result = parseMarkdownIntoSections(md);
    expect(result.some((s) => s.header === 'RealHeader')).toBe(true);
  });

  it('filters out a completely empty headerless section of blank lines', () => {
    // A block of only blank lines at the start (no header, no content) is discarded.
    const md = '\n\n\n**Header**\nContent.';
    const result = parseMarkdownIntoSections(md);
    expect(result.every((s) => s.header !== null || s.lines.some((l) => l.trim()))).toBe(true);
  });

  it('does not duplicate sections for trailing blank lines', () => {
    const md = '**Header**\nContent.\n\n\n\n';
    const result = parseMarkdownIntoSections(md);
    expect(result).toHaveLength(1);
  });
});

describe('parseMarkdownIntoSections — real Claude response shape', () => {
  const REAL_RESPONSE = `**🎯 Overall Assessment**
You're tracking well toward your goal! Your average intake is close to target.

**✅ Actionable Suggestions**
- Boost protein to ~140g/day — you're averaging 95g
- Swap white rice for cauliflower rice 2–3x/week to cut ~150 cal
- Add a handful of spinach to your morning smoothie

**🔄 Food Swap Ideas**
- Greek yogurt instead of sour cream → saves ~60 cal, +8g protein
- Sparkling water instead of juice → saves ~110 cal

**📋 3-Day Meal Plan**
Day 1: Oatmeal with berries (breakfast), Grilled chicken salad (lunch)
Day 2: Greek yogurt parfait (breakfast), Turkey wrap (lunch)
Day 3: Scrambled eggs (breakfast), Lentil soup (lunch)

**📚 References**
- USDA Dietary Guidelines — https://www.dietaryguidelines.gov
- NIH Office of Dietary Supplements — https://ods.od.nih.gov`;

  it('produces 5 sections from a typical Claude response', () => {
    const result = parseMarkdownIntoSections(REAL_RESPONSE);
    expect(result).toHaveLength(5);
  });

  it('identifies the correct section headers', () => {
    const result = parseMarkdownIntoSections(REAL_RESPONSE);
    const headers = result.map((s) => s.header);
    expect(headers).toContain('🎯 Overall Assessment');
    expect(headers).toContain('✅ Actionable Suggestions');
    expect(headers).toContain('🔄 Food Swap Ideas');
    expect(headers).toContain('📋 3-Day Meal Plan');
    expect(headers).toContain('📚 References');
  });

  it('marks only the References section as isReferences', () => {
    const result = parseMarkdownIntoSections(REAL_RESPONSE);
    const refSection = result.find((s) => s.header?.includes('References'));
    const otherSections = result.filter((s) => !s.header?.includes('References'));
    expect(refSection?.isReferences).toBe(true);
    otherSections.forEach((s) => expect(s.isReferences).toBe(false));
  });

  it('keeps bullet lines in the Suggestions section', () => {
    const result = parseMarkdownIntoSections(REAL_RESPONSE);
    const suggestions = result.find((s) => s.header?.includes('Actionable'));
    expect(suggestions?.lines.some((l) => l.includes('Boost protein'))).toBe(true);
  });

  it('keeps reference links in the References section', () => {
    const result = parseMarkdownIntoSections(REAL_RESPONSE);
    const refs = result.find((s) => s.isReferences);
    expect(refs?.lines.some((l) => l.includes('dietaryguidelines.gov'))).toBe(true);
  });

  it('no section header contains ** markers', () => {
    const result = parseMarkdownIntoSections(REAL_RESPONSE);
    result.forEach((s) => {
      if (s.header) expect(s.header).not.toContain('**');
    });
  });
});
