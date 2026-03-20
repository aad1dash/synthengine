/**
 * SentimentAnalyzer — Uses AFINN-165 lexicon for word-level sentiment analysis.
 *
 * Produces per-sentence valence and arousal, plus an overall emotional arc,
 * average valence, and valence range.
 */

import afinn from './data/afinn-165.json' with { type: 'json' };

/**
 * Tokenize a sentence into lowercase words stripped of punctuation.
 * @param {string} sentence
 * @returns {string[]}
 */
function tokenize(sentence) {
  return sentence
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, '')
    .split(/\s+/)
    .map(w => w.replace(/^['-]+|['-]+$/g, ''))
    .filter(w => w.length > 0);
}

/**
 * Analyze sentiment for a single sentence.
 * @param {string} sentence
 * @returns {{ valence: number, arousal: number, sentimentWordCount: number, wordCount: number }}
 */
function analyzeSentence(sentence) {
  const words = tokenize(sentence);
  const wordCount = words.length;

  if (wordCount === 0) {
    return { valence: 0, arousal: 0, sentimentWordCount: 0, wordCount: 0 };
  }

  let totalValence = 0;
  let sentimentWordCount = 0;

  for (const word of words) {
    if (word in afinn) {
      totalValence += afinn[word];
      sentimentWordCount++;
    }
  }

  // Average valence over sentiment words (or 0 if none found)
  const valence = sentimentWordCount > 0
    ? totalValence / sentimentWordCount
    : 0;

  // Arousal is the absolute magnitude of valence — intensity regardless of direction
  const arousal = Math.abs(valence);

  return { valence, arousal, sentimentWordCount, wordCount };
}

/**
 * Analyze text for sentiment.
 * @param {string} text - Full input text
 * @param {string[]} sentences - Pre-split sentences
 * @returns {object} Sentiment profile
 */
export function analyze(text, sentences) {
  const perSentence = sentences.map(analyzeSentence);
  const emotionalArc = perSentence.map(s => s.valence);

  // Compute overall metrics
  let totalValence = 0;
  let count = 0;
  let minValence = Infinity;
  let maxValence = -Infinity;

  for (const entry of perSentence) {
    totalValence += entry.valence;
    count++;
    if (entry.valence < minValence) minValence = entry.valence;
    if (entry.valence > maxValence) maxValence = entry.valence;
  }

  if (count === 0) {
    minValence = 0;
    maxValence = 0;
  }

  const averageValence = count > 0 ? totalValence / count : 0;
  const valenceRange = { min: minValence, max: maxValence, spread: maxValence - minValence };

  // Compute average arousal
  let totalArousal = 0;
  for (const entry of perSentence) {
    totalArousal += entry.arousal;
  }
  const averageArousal = count > 0 ? totalArousal / count : 0;

  return {
    perSentence,
    emotionalArc,
    averageValence,
    averageArousal,
    // Convenience aliases for top-level access
    valence: averageValence,
    arousal: averageArousal,
    valenceRange,
  };
}
