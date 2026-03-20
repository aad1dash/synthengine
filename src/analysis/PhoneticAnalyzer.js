/**
 * PhoneticAnalyzer — Analyzes raw text for phonetic properties.
 *
 * Produces per-sentence phonetic profiles including vowel/consonant ratios,
 * plosive density, sibilance, nasal density, fricative density,
 * and the dominant phoneme type.
 */

import phonemeMap from './data/phoneme-map.json' with { type: 'json' };

const VOWELS = new Set(phonemeMap.vowels);
const PLOSIVES = new Set(phonemeMap.plosives);
const NASALS_SINGLE = new Set(phonemeMap.nasals.filter(p => p.length === 1)); // m, n
const SIBILANTS_SINGLE = new Set(phonemeMap.sibilants.filter(p => p.length === 1)); // s, z
const FRICATIVES_SINGLE = new Set(phonemeMap.fricatives.filter(p => p.length === 1)); // f, v, s, z, h
const LIQUIDS = new Set(phonemeMap.liquids);

// Multi-char phonemes that need bigram detection
const DIGRAPH_NASALS = new Set(phonemeMap.nasals.filter(p => p.length === 2)); // ng
const DIGRAPH_SIBILANTS = new Set(phonemeMap.sibilants.filter(p => p.length === 2)); // sh, ch
const DIGRAPH_FRICATIVES = new Set(phonemeMap.fricatives.filter(p => p.length === 2)); // th, sh

/**
 * Count occurrences of phoneme categories in a string of text.
 * Handles both single-char and digraph phonemes.
 * @param {string} text - Lowercased alphabetic text
 * @returns {object} Counts for each phoneme category
 */
function countPhonemes(text) {
  const lower = text.toLowerCase();
  const alpha = lower.replace(/[^a-z]/g, '');
  const totalAlpha = alpha.length;

  if (totalAlpha === 0) {
    return {
      totalAlpha: 0,
      vowels: 0,
      plosives: 0,
      fricatives: 0,
      nasals: 0,
      sibilants: 0,
      liquids: 0,
    };
  }

  let vowels = 0;
  let plosives = 0;
  let fricatives = 0;
  let nasals = 0;
  let sibilants = 0;
  let liquids = 0;

  // First pass: count digraphs
  const digraphUsed = new Uint8Array(alpha.length);

  for (let i = 0; i < alpha.length - 1; i++) {
    const bigram = alpha[i] + alpha[i + 1];

    if (DIGRAPH_NASALS.has(bigram)) {
      nasals++;
      digraphUsed[i] = 1;
      digraphUsed[i + 1] = 1;
    }

    if (DIGRAPH_SIBILANTS.has(bigram)) {
      sibilants++;
      digraphUsed[i] = 1;
      digraphUsed[i + 1] = 1;
    }

    if (DIGRAPH_FRICATIVES.has(bigram)) {
      fricatives++;
      digraphUsed[i] = 1;
      digraphUsed[i + 1] = 1;
    }
  }

  // Second pass: count single-char phonemes (skip chars already used in digraphs)
  for (let i = 0; i < alpha.length; i++) {
    const ch = alpha[i];

    if (VOWELS.has(ch)) vowels++;

    if (!digraphUsed[i]) {
      if (PLOSIVES.has(ch)) plosives++;
      if (FRICATIVES_SINGLE.has(ch)) fricatives++;
      if (NASALS_SINGLE.has(ch)) nasals++;
      if (SIBILANTS_SINGLE.has(ch)) sibilants++;
      if (LIQUIDS.has(ch)) liquids++;
    }
  }

  return { totalAlpha, vowels, plosives, fricatives, nasals, sibilants, liquids };
}

/**
 * Determine which phoneme category is most dominant by density.
 * @param {object} counts - Phoneme count object
 * @returns {string} Name of the dominant category
 */
function dominantCategory(counts) {
  if (counts.totalAlpha === 0) return 'none';

  const categories = [
    { name: 'vowels', count: counts.vowels },
    { name: 'plosives', count: counts.plosives },
    { name: 'fricatives', count: counts.fricatives },
    { name: 'nasals', count: counts.nasals },
    { name: 'sibilants', count: counts.sibilants },
    { name: 'liquids', count: counts.liquids },
  ];

  let best = categories[0];
  for (let i = 1; i < categories.length; i++) {
    if (categories[i].count > best.count) {
      best = categories[i];
    }
  }
  return best.name;
}

/**
 * Build a phonetic profile for a single sentence.
 * @param {string} sentence
 * @returns {object} Phonetic profile
 */
function profileSentence(sentence) {
  const counts = countPhonemes(sentence);
  const total = counts.totalAlpha || 1; // avoid division by zero

  const vowelRatio = counts.vowels / total;

  return {
    vowelRatio,
    consonantRatio: 1 - vowelRatio,
    plosiveDensity: counts.plosives / total,
    sibilance: counts.sibilants / total,
    nasalDensity: counts.nasals / total,
    fricativeDensity: counts.fricatives / total,
    dominantPhonemeType: dominantCategory(counts),
  };
}

/**
 * Analyze text for phonetic properties.
 * @param {string} text - Full input text
 * @param {string[]} sentences - Pre-split sentences
 * @returns {object[]} Array of per-sentence phonetic profiles
 */
export function analyze(text, sentences) {
  return sentences.map(profileSentence);
}
