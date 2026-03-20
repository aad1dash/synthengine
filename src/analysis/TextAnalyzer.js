/**
 * TextAnalyzer — Orchestrator for the text analysis pipeline.
 *
 * Splits text into sentences, runs all five analyzers, computes a master hash,
 * and returns a complete TextFingerprint object.
 */

import { murmurhash3 } from '../utils/hash.js';
import * as PhoneticAnalyzer from './PhoneticAnalyzer.js';
import * as StructuralAnalyzer from './StructuralAnalyzer.js';
import * as SentimentAnalyzer from './SentimentAnalyzer.js';
import * as RhythmAnalyzer from './RhythmAnalyzer.js';
import * as LexicalAnalyzer from './LexicalAnalyzer.js';

/**
 * Common abbreviations that should not trigger sentence splits.
 * These end with a period but are not sentence terminators.
 */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr',
  'st', 'ave', 'blvd', 'rd',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'inc', 'ltd', 'co', 'corp', 'dept', 'univ',
  'vs', 'etc', 'approx', 'appt',
  'govt', 'est', 'assn',
  'fig', 'vol', 'no', 'pp',
  'i.e', 'e.g', 'a.m', 'p.m',
]);

/**
 * Split text into sentences.
 *
 * Strategy:
 * 1. Split on sentence-ending punctuation (.!?) followed by whitespace or end-of-string.
 * 2. Avoid splitting on abbreviations (e.g., "Mr.", "Dr.", "etc.").
 * 3. Handle ellipsis (...) by not splitting mid-ellipsis.
 *
 * @param {string} text
 * @returns {string[]} Array of sentence strings
 */
function splitSentences(text) {
  if (!text || text.trim().length === 0) return [];

  const sentences = [];
  let current = '';
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    current += ch;

    // Check for sentence-ending punctuation
    if (ch === '.' || ch === '!' || ch === '?') {
      // Handle ellipsis: don't split on "..."
      if (ch === '.' && i + 1 < text.length && text[i + 1] === '.') {
        i++;
        continue;
      }

      // Check if followed by whitespace, newline, or end of string
      const nextChar = i + 1 < text.length ? text[i + 1] : ' ';
      const isTerminal = /[\s]/.test(nextChar) || i + 1 >= text.length;

      if (!isTerminal) {
        i++;
        continue;
      }

      // Check for abbreviations (only for periods)
      if (ch === '.') {
        // Extract the word immediately before the period
        const trimmed = current.trimEnd();
        const periodPos = trimmed.length - 1;
        let wordStart = periodPos - 1;
        while (wordStart >= 0 && /[a-zA-Z.]/.test(trimmed[wordStart])) {
          wordStart--;
        }
        const word = trimmed.slice(wordStart + 1, periodPos).toLowerCase();

        if (ABBREVIATIONS.has(word)) {
          i++;
          continue;
        }

        // Single uppercase letter followed by period (initials like "J.")
        if (word.length === 1 && /[a-z]/.test(word)) {
          // Check if next non-space char is uppercase (likely an initial)
          let peek = i + 1;
          while (peek < text.length && text[peek] === ' ') peek++;
          if (peek < text.length && /[A-Z]/.test(text[peek])) {
            i++;
            continue;
          }
        }
      }

      // This looks like a real sentence boundary
      const trimmedSentence = current.trim();
      if (trimmedSentence.length > 0) {
        sentences.push(trimmedSentence);
      }
      current = '';
    }

    i++;
  }

  // Add any remaining text as a final sentence
  const remaining = current.trim();
  if (remaining.length > 0) {
    sentences.push(remaining);
  }

  return sentences;
}

/**
 * Analyze a complete text and produce a TextFingerprint.
 *
 * @param {string} text - The input text to analyze
 * @returns {object} TextFingerprint object
 */
export function analyzeText(text) {
  const normalizedText = text || '';
  const sentences = splitSentences(normalizedText);
  const masterHash = murmurhash3(normalizedText, 0);

  const phonetic = PhoneticAnalyzer.analyze(normalizedText, sentences);
  const structural = StructuralAnalyzer.analyze(normalizedText, sentences);
  const sentiment = SentimentAnalyzer.analyze(normalizedText, sentences);
  const rhythm = RhythmAnalyzer.analyze(normalizedText, sentences);
  const lexical = LexicalAnalyzer.analyze(normalizedText, sentences);

  return {
    text: normalizedText,
    sentences,
    masterHash,
    phonetic,
    structural,
    sentiment,
    rhythm,
    lexical,
  };
}
