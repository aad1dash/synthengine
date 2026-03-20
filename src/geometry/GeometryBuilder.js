/**
 * GeometryBuilder — Dispatcher that maps WorldGraph nodes to the
 * appropriate geometry generator.
 *
 * Room types:  'vault' | 'chamber' | 'crystal' | 'dome' | 'corridor'
 *   - 'chamber' maps to VaultGenerator with reduced scale.
 */

import * as VaultGenerator from './VaultGenerator.js';
import * as CrystalGenerator from './CrystalGenerator.js';
import * as DomeGenerator from './DomeGenerator.js';
import * as CorridorGenerator from './CorridorGenerator.js';
import * as VoidGenerator from './VoidGenerator.js';
import * as LandmarkGenerator from './LandmarkGenerator.js';

/* ------------------------------------------------------------------ */
/*  Room builder                                                       */
/* ------------------------------------------------------------------ */

/**
 * Build the 3-D geometry for a room node from the WorldGraph.
 *
 * @param {object} roomNode
 * @param {string} roomNode.geometryType  'vault'|'chamber'|'crystal'|'dome'|'corridor'
 * @param {object} roomNode.props         generator-specific properties
 * @param {THREE.Material} material
 * @returns {THREE.Group}
 */
export function buildRoom(roomNode, material) {
  const type = roomNode.geometryType || 'vault';
  // Room node IS the props object (flat properties: scale, clauseDepth, wordCount, seed, etc.)
  const props = roomNode;

  switch (type) {
    case 'vault':
      return VaultGenerator.generate(props, material);

    case 'chamber': {
      // A chamber is a smaller vault — clamp scale downward.
      const chamberProps = {
        ...props,
        scale: Math.max(1, (props.scale || 2) * 0.6),
      };
      return VaultGenerator.generate(chamberProps, material);
    }

    case 'crystal':
      return CrystalGenerator.generate(props, material);

    case 'dome':
      return DomeGenerator.generate(props, material);

    case 'corridor':
      return CorridorGenerator.generate(props, material);

    default:
      console.warn(`GeometryBuilder: unknown room type "${type}", falling back to vault.`);
      return VaultGenerator.generate(props, material);
  }
}

/* ------------------------------------------------------------------ */
/*  Void builder                                                       */
/* ------------------------------------------------------------------ */

/**
 * Build geometry for a void (inter-paragraph gap).
 *
 * @param {object} voidNode
 * @param {object} voidNode.props   VoidGenerator-specific properties
 * @param {THREE.Material} material
 * @returns {THREE.Group}
 */
export function buildVoid(voidNode, material) {
  // Void node IS the props object (flat properties: span, nebulaHue, particleDensity, seed)
  return VoidGenerator.generate(voidNode, material);
}

/* ------------------------------------------------------------------ */
/*  Landmark builder                                                   */
/* ------------------------------------------------------------------ */

/**
 * Build geometry for a landmark (notable word marker).
 *
 * @param {object} landmarkData
 * @param {string} landmarkData.type  'pillar' | 'crystal'
 * @param {object} landmarkData.props generator-specific properties
 * @param {THREE.Material} material
 * @returns {THREE.Group}
 */
export function buildLandmark(landmarkData, material) {
  const type = landmarkData.type || 'pillar';
  // Landmark data IS the props object (flat properties: word, frequency, seed, localPosition)

  switch (type) {
    case 'pillar':
      return LandmarkGenerator.generatePillar(landmarkData, material);

    case 'crystal':
      return LandmarkGenerator.generateCrystal(landmarkData, material);

    default:
      console.warn(`GeometryBuilder: unknown landmark type "${type}", falling back to pillar.`);
      return LandmarkGenerator.generatePillar(landmarkData, material);
  }
}
