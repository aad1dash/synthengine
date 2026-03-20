/**
 * Synesthesia Engine — Main entry point.
 *
 * Orchestrates: text analysis → world graph → geometry → materials →
 *               scene rendering → audio → navigation → UI
 */
import * as THREE from 'three';
import { analyzeText } from './analysis/TextAnalyzer.js';
import { WorldGraph } from './world/WorldGraph.js';
import { buildRoom, buildVoid, buildLandmark } from './geometry/GeometryBuilder.js';
import { MaterialSystem } from './materials/MaterialSystem.js';
import { PostProcessing } from './materials/PostProcessing.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { MaterializationSequence } from './materialization/MaterializationSequence.js';
import { PlayerController } from './navigation/PlayerController.js';
import { InspectionSystem } from './navigation/InspectionSystem.js';
import { Minimap } from './navigation/Minimap.js';
import { CinematicMode } from './navigation/CinematicMode.js';
import { EntryScreen } from './ui/EntryScreen.js';
import { HUD } from './ui/HUD.js';
import { Gallery } from './ui/Gallery.js';
import { URLEncoder } from './sharing/URLEncoder.js';
import { showToast } from './ui/Toast.js';

// ─── State ───────────────────────────────────────────────────────────
let renderer, scene, camera, clock;
let postProcessing;
let materialSystem;
let audioEngine;
let playerController;
let inspectionSystem, minimap, cinematicMode;
let materializationSeq;
let entryScreen, hud;
let gallery;
let worldGraph;

// Maps mesh → room index for raycasting
const meshToRoomMap = new Map();
let currentRoomIndex = 0;

// ─── Init ────────────────────────────────────────────────────────────
function initThree() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('app').appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020208);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 1.7, 0);

  clock = new THREE.Clock();

  // Cosmic background — subtle star field
  addStarField();

  window.addEventListener('resize', onResize);
}

function addStarField() {
  const count = 2000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = 150 + Math.random() * 200;
    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.cos(phi);
    positions[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const brightness = 0.3 + Math.random() * 0.7;
    colors[i3] = brightness;
    colors[i3 + 1] = brightness;
    colors[i3 + 2] = brightness + Math.random() * 0.2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  scene.add(new THREE.Points(geo, mat));
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  postProcessing?.resize(window.innerWidth, window.innerHeight);
}

// ─── World Building ──────────────────────────────────────────────────
function buildWorld(text) {
  // Defense-in-depth: cap text length
  if (text.length > 10000) {
    text = text.slice(0, 10000);
    showToast('Text truncated to 10,000 characters', 'warn');
  }

  try {
    // Clear previous world
    clearWorld();

    // 1. Analyze text
    const fingerprint = analyzeText(text);

    // 2. Build world graph
    worldGraph = new WorldGraph(fingerprint);

    // 3. Setup materials
    materialSystem = new MaterialSystem();
    const fogSettings = materialSystem.getFogSettings(fingerprint.sentiment);
    scene.fog = new THREE.Fog(fogSettings.color, fogSettings.near, fogSettings.far);

    // 4. Setup lighting
    materialSystem.setupLighting(scene, fingerprint.sentiment);

    // 5. Build room geometry
    const roomMeshes = [];
    for (const room of worldGraph.rooms) {
      const material = room.geometryType === 'crystal'
        ? materialSystem.createCrystalMaterial(room)
        : materialSystem.createRoomMaterial(room);
      const group = buildRoom(room, material);
      group.position.set(room.position.x, room.position.y, room.position.z);
      group.rotation.y = room.rotation || 0;
      group.userData.isWorldObject = true;
      scene.add(group);
      roomMeshes.push(group);
      // Map all children for raycasting
      group.traverse((child) => {
        if (child.isMesh) meshToRoomMap.set(child, room.index);
      });
    }

    // 6. Build void geometry
    for (const voidNode of worldGraph.voids) {
      const material = materialSystem.createVoidMaterial(voidNode);
      const group = buildVoid(voidNode, material);
      group.position.set(voidNode.position.x, voidNode.position.y, voidNode.position.z);
      group.userData.isWorldObject = true;
      scene.add(group);
    }

    // 7. Build landmarks
    for (const landmark of worldGraph.landmarks) {
      const room = worldGraph.getRoom(landmark.roomIndex);
      const material = landmark.type === 'pillar'
        ? materialSystem.createPillarMaterial(landmark.frequency)
        : materialSystem.createFloatingCrystalMaterial();
      const group = buildLandmark(landmark, material);
      group.position.set(
        room.position.x + landmark.localPosition.x,
        landmark.localPosition.y,
        room.position.z + landmark.localPosition.z
      );
      group.userData.isWorldObject = true;
      scene.add(group);
    }

    // 8. Post-processing
    postProcessing = new PostProcessing(renderer, scene, camera);
    postProcessing.configure(fingerprint.sentiment);

    // 9. Setup navigation
    playerController = new PlayerController(camera, renderer.domElement);
    const room0 = worldGraph.rooms[0];
    if (room0) {
      playerController.setPosition(room0.position.x, null, room0.position.z);
    }

    inspectionSystem = new InspectionSystem(camera, worldGraph);
    inspectionSystem.setMeshes(Array.from(meshToRoomMap.keys()));
    minimap = new Minimap(worldGraph);
    cinematicMode = new CinematicMode(camera, worldGraph);

    // 10. Setup HUD
    hud = new HUD(() => {
      // On exit — return to entry screen
      stopWorld();
      entryScreen.show();
    });

    // 11. Audio — pass worldGraph rooms which have position, scale, seed, etc.
    audioEngine = new AudioEngine();
    audioEngine.init().then(() => {
      audioEngine.configure({ ...fingerprint, rooms: worldGraph.rooms });
      audioEngine.start();
    }).catch((e) => {
      console.warn('Audio initialization failed:', e);
      showToast('Audio unavailable', 'warn');
    });

    // 12. Materialization animation
    materializationSeq = new MaterializationSequence(scene, camera, worldGraph, () => {
      // Animation complete — hand control to player
      renderer.domElement.addEventListener('click', () => {
        playerController.lock();
      }, { once: true });
      // Auto-lock after materialization
      playerController.lock();
      hud.setVisible(true);
    });
    materializationSeq.setRoomMeshes(roomMeshes);
    materializationSeq.start();

    // 13. Share URL
    const shareUrl = URLEncoder.encode(text);
    window.history.replaceState(null, '', shareUrl.replace(window.location.origin, ''));

    // 14. Save to gallery
    gallery.save(text).catch((e) => {
      console.warn('Gallery save failed:', e);
      showToast('Could not save to gallery', 'warn');
    });

    // 15. Key handlers for cinematic + recording
    document.addEventListener('keydown', handleWorldKeys);
  } catch (e) {
    console.error('World build failed:', e);
    clearWorld();
    showToast('Failed to build world — try different text', 'error');
    entryScreen.show();
  }
}

function handleWorldKeys(e) {
  if (e.code === 'KeyC') {
    cinematicMode?.toggle();
  }
  if (e.code === 'KeyR' && cinematicMode?.isActive()) {
    if (cinematicMode.isRecording) {
      cinematicMode.stopRecording();
    } else {
      cinematicMode.startRecording(renderer.domElement);
    }
  }
}

function clearWorld() {
  document.removeEventListener('keydown', handleWorldKeys);

  // Remove only tagged world objects and dispose GPU resources
  const toRemove = [];
  scene.traverse((obj) => {
    if (obj.userData?.isWorldObject) toRemove.push(obj);
  });
  for (const obj of toRemove) {
    obj.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
    scene.remove(obj);
  }

  meshToRoomMap.clear();
  materialSystem?.dispose();
  audioEngine?.stop();
  audioEngine?.dispose();
  playerController?.dispose();
  inspectionSystem?.dispose();
  minimap?.dispose();
  cinematicMode?.dispose();
  hud?.dispose();
  postProcessing?.dispose();
  materializationSeq?.dispose();

  materialSystem = null;
  audioEngine = null;
  playerController = null;
  inspectionSystem = null;
  minimap = null;
  cinematicMode = null;
  hud = null;
  postProcessing = null;
  materializationSeq = null;
  worldGraph = null;
}

function stopWorld() {
  clearWorld();
}

// ─── Game Loop ───────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); // cap delta time

  // Materialization sequence
  if (materializationSeq?.isActive()) {
    materializationSeq.update(dt);
    if (postProcessing) {
      postProcessing.render();
    } else {
      renderer.render(scene, camera);
    }
    return;
  }

  // Cinematic mode
  if (cinematicMode?.isActive()) {
    cinematicMode.update(dt);
  } else {
    // Player controller
    playerController?.update(dt);
  }

  // Detect current room
  if (worldGraph && playerController) {
    const pos = playerController.position;
    const nearest = worldGraph.getNearestRoom(pos.x, pos.z);
    if (nearest && nearest.index !== currentRoomIndex) {
      currentRoomIndex = nearest.index;
      audioEngine?.setActiveRoom(currentRoomIndex);

      // Check if in void
      const isInVoid = worldGraph.voids.some(v => {
        const dx = v.position.x - pos.x;
        const dz = v.position.z - pos.z;
        return Math.sqrt(dx * dx + dz * dz) < v.span / 2;
      });
      if (playerController) playerController.inVoid = isInVoid;
    }

    hud?.updateRoomInfo(currentRoomIndex, worldGraph.rooms.length,
      worldGraph.rooms[currentRoomIndex]?.geometryType || '');
  }

  // Inspection (gaze-based text reveal)
  inspectionSystem?.update(dt, meshToRoomMap);

  // Minimap
  if (playerController) {
    minimap?.update(playerController.position.x, playerController.position.z);
  }

  // Audio listener update
  if (audioEngine && playerController) {
    audioEngine.updateListener(
      playerController.position,
      playerController.getForward(),
      playerController.getUp()
    );
  }

  // Render
  if (postProcessing) {
    postProcessing.render();
  } else {
    renderer.render(scene, camera);
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────
async function main() {
  initThree();
  gallery = new Gallery();

  // Check URL for shared world
  const sharedText = await URLEncoder.decode();

  entryScreen = new EntryScreen((text) => {
    buildWorld(text);
  });

  if (sharedText) {
    entryScreen.setText(sharedText);
  }

  animate();
}

main();
