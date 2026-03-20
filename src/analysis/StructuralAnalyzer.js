/**
 * StructuralAnalyzer — Analyzes text structure.
 *
 * Produces structural profile including sentence lengths, clause depths,
 * paragraph breaks, punctuation maps, and total word count.
 */

/**
 * Count words in a string (split on whitespace, filter empty).
 * @param {string} str
 * @returns {number}
 */
function wordCount(str) {
  const words = str.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

/**
 * Count clause depth for a sentence.
 * Each comma, semicolon, or colon introduces an additional clause level.
 * The base depth is 1 (the sentence itself is one clause).
 * @param {string} sentence
 * @returns {number}
 */
function clauseDepth(sentence) {
  let depth = 1;
  for (let i = 0; i < sentence.length; i++) {
    const ch = sentence[i];
    if (ch === ',' || ch === ';' || ch === ':') {
      depth++;
    }
  }
  return depth;
}

/**
 * Build a punctuation count map for a sentence.
 * @param {string} sentence
 * @returns {object}
 */
function punctuationMap(sentence) {
  const map = {
    period: 0,
    comma: 0,
    semicolon: 0,
    colon: 0,
    dash: 0,
    question: 0,
    exclamation: 0,
  };

  for (let i = 0; i < sentence.length; i++) {
    switch (sentence[i]) {
      case '.': map.period++; break;
      case ',': map.comma++; break;
      case ';': map.semicolon++; break;
      case ':': map.colon++; break;
      case '-':
      case '\u2013': // en-dash
      case '\u2014': // em-dash
        map.dash++; break;
      case '?': map.question++; break;
      case '!': map.exclamation++; break;
    }
  }

  return map;
}

/**
 * Determine paragraph boundaries.
 * Paragraphs are separated by double newlines (\n\n).
 * Returns the number of paragraphs and the sentence indices where breaks occur.
 *
 * @param {string} text - Full original text
 * @param {string[]} sentences - Ordered array of sentences
 * @returns {{ paragraphCount: number, paragraphBreaks: number[] }}
 */
function analyzeParagraphs(text, sentences) {
  // Split text into paragraphs by double newline
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const paragraphCount = paragraphs.length;

  // Determine sentence indices where paragraph breaks occur.
  // Walk through sentences and match them to paragraphs to find break points.
  const paragraphBreaks = [];

  if (paragraphCount <= 1 || sentences.length === 0) {
    return { paragraphCount, paragraphBreaks };
  }

  // Build a position map: find each sentence's start position in the original text
  let searchStart = 0;
  const sentencePositions = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length === 0) {
      sentencePositions.push(searchStart);
      continue;
    }
    const idx = text.indexOf(trimmed, searchStart);
    sentencePositions.push(idx >= 0 ? idx : searchStart);
    if (idx >= 0) {
      searchStart = idx + trimmed.length;
    }
  }

  // Find positions of double-newline breaks in the original text
  const breakPositions = [];
  const breakRegex = /\n\s*\n/g;
  let match;
  while ((match = breakRegex.exec(text)) !== null) {
    breakPositions.push(match.index + match[0].length);
  }

  // For each break position, find the first sentence that starts at or after it
  for (const breakPos of breakPositions) {
    for (let i = 0; i < sentencePositions.length; i++) {
      if (sentencePositions[i] >= breakPos) {
        paragraphBreaks.push(i);
        break;
      }
    }
  }

  return { paragraphCount, paragraphBreaks };
}

/**
 * Analyze text structure.
 * @param {string} text - Full input text
 * @param {string[]} sentences - Pre-split sentences
 * @returns {object} Structural profile
 */
export function analyze(text, sentences) {
  const sentenceLengths = sentences.map(wordCount);
  const clauseDepths = sentences.map(clauseDepth);
  const punctuationMaps = sentences.map(punctuationMap);
  const { paragraphCount, paragraphBreaks } = analyzeParagraphs(text, sentences);
  const totalWordCount = sentenceLengths.reduce((sum, n) => sum + n, 0);

  return {
    sentenceLengths,
    clauseDepths,
    paragraphCount,
    paragraphBreaks,
    punctuationMap: punctuationMaps,
    totalWordCount,
  };
}
