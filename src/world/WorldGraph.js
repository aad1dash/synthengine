/**
 * Converts a TextFingerprint into an abstract spatial graph.
 *
 * The graph contains:
 *  - Room nodes (one per sentence)
 *  - Void nodes (one per paragraph break)
 *  - Edges connecting rooms/voids
 *  - Landmarks (pillars for repeated words, crystals for hapax legomena)
 */

import { murmurhash3 } from '../utils/hash.js';
import { createRNG } from '../utils/seededRandom.js';
import { clamp, mapRange } from '../utils/math.js';
import { classifyRoom, classifyEdge, edgeAngle } from './RoomTypes.js';

export class WorldGraph {
  constructor(fingerprint) {
    this.fingerprint = fingerprint;
    this.rooms = [];
    this.voids = [];
    this.edges = [];
    this.landmarks = [];
    this.rng = createRNG(fingerprint.masterHash);

    this._buildRooms();
    this._buildVoids();
    this._buildEdges();
    this._buildLandmarks();
    this._computePositions();
  }

  _buildRooms() {
    const { sentences, phonetic, structural, sentiment, rhythm, lexical } = this.fingerprint;
    if (!sentences?.length) return;

    const maxRooms = Math.min(sentences.length, 100);
    for (let i = 0; i < maxRooms; i++) {
      const wordCount = structural.sentenceLengths[i] || 1;
      const clauseDepth = structural.clauseDepths[i] || 0;
      const phoneticProfile = phonetic[i] || {};
      const valence = sentiment.perSentence[i]?.valence || 0;
      const arousal = sentiment.perSentence[i]?.arousal || 0;
      const tempo = rhythm.perSentence[i]?.tempo || 1;
      const seed = murmurhash3(sentences[i], this.fingerprint.masterHash);

      const geometryType = classifyRoom(phoneticProfile, wordCount);

      // Scale: sentence length + clause depth → 1-5
      const lengthFactor = clamp(wordCount / 20, 0, 1);
      const depthFactor = clamp(clauseDepth / 4, 0, 1);
      const scale = 1 + (lengthFactor * 2.5 + depthFactor * 1.5);

      // Stress pattern from rhythm data
      const stressPattern = rhythm.perSentence[i]?.stressPattern || [1, 0, 1, 0];

      this.rooms.push({
        index: i,
        type: 'room',
        sentence: sentences[i],
        geometryType,
        scale,
        clauseDepth,
        wordCount,
        phonetic: phoneticProfile,
        valence,
        arousal,
        tempo,
        seed,
        stressPattern,
        typeTokenRatio: lexical.typeTokenRatio || 0.5,
        consonantDensity: phoneticProfile.consonantRatio || 0.5,
        // position computed later
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
      });
    }
  }

  _buildVoids() {
    const { structural, sentiment } = this.fingerprint;
    const breaks = structural.paragraphBreaks || [];

    for (let i = 0; i < breaks.length; i++) {
      const breakIdx = breaks[i];
      // Sentiment around the break
      const beforeValence = sentiment.perSentence[breakIdx - 1]?.valence || 0;
      const afterValence = sentiment.perSentence[breakIdx]?.valence || 0;
      const avgValence = (beforeValence + afterValence) / 2;

      // Map valence to hue for nebula
      const nebulaHue = mapRange(avgValence, -5, 5, 270, 30);
      const seed = murmurhash3(`void_${i}`, this.fingerprint.masterHash);

      this.voids.push({
        index: i,
        type: 'void',
        sentenceIndex: breakIdx, // void inserted before this sentence
        span: 15 + this.rng.range(0, 10),
        nebulaHue,
        particleDensity: 0.3 + this.rng.random() * 0.5,
        seed,
        position: { x: 0, y: 0, z: 0 },
      });
    }
  }

  _buildEdges() {
    const { structural } = this.fingerprint;
    const voidSentenceIndices = new Set(this.voids.map(v => v.sentenceIndex));

    for (let i = 0; i < this.rooms.length - 1; i++) {
      const nextIdx = i + 1;

      // Check if there's a void between these rooms
      if (voidSentenceIndices.has(nextIdx)) {
        const voidNode = this.voids.find(v => v.sentenceIndex === nextIdx);
        // Edge from room to void
        this.edges.push({
          from: { type: 'room', index: i },
          to: { type: 'void', index: voidNode.index },
          edgeType: 'bridge',
          angle: 0,
        });
        // Edge from void to next room
        this.edges.push({
          from: { type: 'void', index: voidNode.index },
          to: { type: 'room', index: nextIdx },
          edgeType: 'bridge',
          angle: 0,
        });
      } else {
        // Direct room-to-room edge
        const punct = structural.punctuationMap[i] || {};
        const edgeType = classifyEdge(punct);
        const angle = edgeAngle(edgeType);

        this.edges.push({
          from: { type: 'room', index: i },
          to: { type: 'room', index: nextIdx },
          edgeType,
          angle,
        });
      }
    }
  }

  _buildLandmarks() {
    const { lexical } = this.fingerprint;

    // Pillars for repeated words (frequency > 2)
    const repeatedWords = (lexical.repeatedWords || []).slice(0, 50);
    const wordFreq = lexical.wordFrequencyMap || new Map();
    const placedPillars = new Set();

    for (const word of repeatedWords) {
      // Find the first sentence containing this word
      for (let i = 0; i < this.rooms.length; i++) {
        const sentenceWords = this.rooms[i].sentence.toLowerCase().split(/\s+/);
        if (sentenceWords.includes(word) && !placedPillars.has(word)) {
          placedPillars.add(word);
          // wordFrequencyMap may be a Map or plain object
          const freq = (wordFreq instanceof Map ? wordFreq.get(word) : wordFreq[word]) || 3;
          this.landmarks.push({
            type: 'pillar',
            word,
            frequency: freq,
            roomIndex: i,
            seed: murmurhash3(word, this.fingerprint.masterHash),
            localPosition: {
              x: this.rng.range(-3, 3),
              y: 0,
              z: this.rng.range(-3, 3),
            },
          });
          break;
        }
      }
    }

    // Floating crystals for hapax legomena
    const hapax = lexical.hapaxLegomena || [];
    for (const word of hapax.slice(0, 30)) { // cap at 30 crystals
      // Find which sentence contains this word
      for (let i = 0; i < this.rooms.length; i++) {
        const sentenceWords = this.rooms[i].sentence.toLowerCase().split(/\s+/);
        if (sentenceWords.includes(word)) {
          this.landmarks.push({
            type: 'crystal',
            word,
            roomIndex: i,
            seed: murmurhash3(word, this.fingerprint.masterHash),
            localPosition: {
              x: this.rng.range(-4, 4),
              y: this.rng.range(2, 5),
              z: this.rng.range(-4, 4),
            },
          });
          break;
        }
      }
    }
  }

  _computePositions() {
    // Lay out rooms linearly along a path with turns at edges
    let x = 0;
    let z = 0;
    let heading = 0; // radians, 0 = +Z direction

    const ROOM_SPACING = 12;
    const VOID_SPACING = 25;

    // Build ordered list of nodes (rooms + voids interleaved)
    const nodeOrder = [];
    const voidMap = new Map(this.voids.map(v => [v.sentenceIndex, v]));

    for (let i = 0; i < this.rooms.length; i++) {
      if (voidMap.has(i)) {
        nodeOrder.push({ type: 'void', node: voidMap.get(i) });
      }
      nodeOrder.push({ type: 'room', node: this.rooms[i] });
    }

    let edgeIdx = 0;
    for (let n = 0; n < nodeOrder.length; n++) {
      const { type, node } = nodeOrder[n];

      node.position.x = x;
      node.position.y = 0;
      node.position.z = z;
      node.rotation = heading;

      // Advance position for next node
      const spacing = type === 'void' ? node.span : ROOM_SPACING + node.scale * 2;

      // Apply turn from edge if applicable
      if (edgeIdx < this.edges.length) {
        const edge = this.edges[edgeIdx];
        // Alternate turn direction deterministically
        const turnDir = (edgeIdx % 2 === 0) ? 1 : -1;
        heading += edge.angle * turnDir;
        edgeIdx++;
        // If void, skip extra edge (void has entry + exit edges)
        if (type === 'void' && edgeIdx < this.edges.length) {
          edgeIdx++;
        }
      }

      x += Math.sin(heading) * spacing;
      z += Math.cos(heading) * spacing;
    }
  }

  /** Get all nodes in traversal order */
  getOrderedNodes() {
    const voidMap = new Map(this.voids.map(v => [v.sentenceIndex, v]));
    const nodes = [];
    for (let i = 0; i < this.rooms.length; i++) {
      if (voidMap.has(i)) nodes.push(voidMap.get(i));
      nodes.push(this.rooms[i]);
    }
    return nodes;
  }

  /** Get room at index */
  getRoom(index) {
    return this.rooms[index];
  }

  /** Get the nearest room to a world position */
  getNearestRoom(worldX, worldZ) {
    let nearest = null;
    let minDist = Infinity;
    for (const room of this.rooms) {
      const dx = room.position.x - worldX;
      const dz = room.position.z - worldZ;
      const dist = dx * dx + dz * dz;
      if (dist < minDist) {
        minDist = dist;
        nearest = room;
      }
    }
    return nearest;
  }
}
