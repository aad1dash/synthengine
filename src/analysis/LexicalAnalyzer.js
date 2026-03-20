/**
 * LexicalAnalyzer — Analyzes vocabulary richness and word frequency.
 *
 * Produces word frequency map, type-token ratio, hapax legomena,
 * repeated words, and vocabulary richness score.
 */

/**
 * Tokenize text into lowercase words.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, '')
    .split(/\s+/)
    .map(w => w.replace(/^['-]+|['-]+$/g, ''))
    .filter(w => w.length > 0);
}

/**
 * Analyze text for lexical properties.
 * @param {string} text - Full input text
 * @param {string[]} sentences - Pre-split sentences (unused but kept for interface consistency)
 * @returns {object} Lexical profile
 */
export function analyze(text, sentences) {
  const words = tokenize(text);
  const totalWords = words.length;

  // Build frequency map
  const wordFrequencyMap = new Map();
  for (const word of words) {
    wordFrequencyMap.set(word, (wordFrequencyMap.get(word) || 0) + 1);
  }

  const uniqueWords = wordFrequencyMap.size;

  // Type-token ratio
  const typeTokenRatio = totalWords > 0 ? uniqueWords / totalWords : 0;

  // Hapax legomena: words appearing exactly once
  const hapaxLegomena = [];
  // Repeated words: words appearing more than 2 times
  const repeatedWords = [];

  for (const [word, count] of wordFrequencyMap) {
    if (count === 1) {
      hapaxLegomena.push(word);
    }
    if (count > 2) {
      repeatedWords.push(word);
    }
  }

  // Sort for deterministic output
  hapaxLegomena.sort();
  repeatedWords.sort();

  // Vocabulary richness: TTR weighted by text length.
  // For short texts, TTR is naturally high (many unique words).
  // We use a log-based correction: richness = TTR * (log(totalWords) / log(2*uniqueWords))
  // This is inspired by Guiraud's index: uniqueWords / sqrt(totalWords),
  // normalized to [0,1] range via the TTR component.
  // For empty text, richness is 0.
  let vocabularyRichness = 0;
  if (totalWords > 0 && uniqueWords > 0) {
    // Guiraud's Index normalized by sqrt(totalWords)
    // Then we blend with TTR for a balanced measure
    const guiraud = uniqueWords / Math.sqrt(totalWords);
    // Normalize: for typical English text, guiraud is roughly 3-10
    // We blend TTR (0-1) with a normalized guiraud score
    const normalizedGuiraud = Math.min(guiraud / 10, 1);
    vocabularyRichness = (typeTokenRatio + normalizedGuiraud) / 2;
  }

  return {
    wordFrequencyMap,
    typeTokenRatio,
    hapaxLegomena,
    repeatedWords,
    vocabularyRichness,
  };
}
