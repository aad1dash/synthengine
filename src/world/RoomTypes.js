/**
 * Classifies sentence phonetic profiles into room geometry types.
 *
 * Room types:
 *  - vault     : soaring arched ceiling — mostly vowels/nasals
 *  - chamber   : tight enclosed space — balanced phonetics
 *  - crystal   : jagged polyhedra — plosive-heavy
 *  - dome      : smooth curved surfaces — nasal-heavy
 *  - corridor  : narrow passage — short sentences (< 6 words)
 */

const CORRIDOR_WORD_THRESHOLD = 6;

export function classifyRoom(phoneticProfile, wordCount) {
  // Short sentences always become corridors
  if (wordCount < CORRIDOR_WORD_THRESHOLD) {
    return 'corridor';
  }

  const { vowelRatio, plosiveDensity, nasalDensity, dominantPhonemeType } = phoneticProfile;

  // Plosive-heavy → crystal
  if (plosiveDensity > 0.15 || dominantPhonemeType === 'plosive') {
    return 'crystal';
  }

  // Nasal-heavy → dome
  if (nasalDensity > 0.12 || dominantPhonemeType === 'nasal') {
    return 'dome';
  }

  // Vowel-heavy → vault
  if (vowelRatio > 0.45 || dominantPhonemeType === 'vowel') {
    return 'vault';
  }

  // Balanced → chamber
  return 'chamber';
}

/**
 * Determine edge type from punctuation ending a sentence.
 *  - period      → doorway
 *  - comma       → gentle turn (15°)
 *  - semicolon   → side passage
 *  - em-dash     → bridge over void
 *  - question    → doorway (wider)
 *  - exclamation → doorway (tall)
 */
export function classifyEdge(punctuation) {
  if (punctuation.dash > 0) return 'bridge';
  if (punctuation.semicolon > 0) return 'sidePassage';
  if (punctuation.comma > 0) return 'turn';
  if (punctuation.question > 0) return 'wideDoorway';
  if (punctuation.exclamation > 0) return 'tallDoorway';
  return 'doorway';
}

/** Get turn angle for an edge type */
export function edgeAngle(edgeType) {
  switch (edgeType) {
    case 'turn': return Math.PI / 12;        // 15°
    case 'sidePassage': return Math.PI / 4;   // 45°
    case 'bridge': return 0;
    case 'wideDoorway': return 0;
    case 'tallDoorway': return 0;
    default: return 0;
  }
}
