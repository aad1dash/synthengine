/**
 * Gaze-based text reveal: look at a surface for 1.5s → text overlay fades in.
 */
import * as THREE from 'three';

const GAZE_THRESHOLD = 1.5; // seconds
const FADE_SPEED = 2.0;
const MAX_DISTANCE = 15;
const CENTER = new THREE.Vector2(0, 0);

export class InspectionSystem {
  constructor(camera, worldGraph) {
    this.camera = camera;
    this.worldGraph = worldGraph;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = MAX_DISTANCE;

    this.gazeTimer = 0;
    this.lastTarget = null;
    this.currentText = null;
    this.overlayOpacity = 0;
    this._meshes = null;

    // Create DOM overlay
    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, {
      position: 'fixed',
      bottom: '15%',
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: '600px',
      padding: '16px 24px',
      background: 'rgba(0, 0, 0, 0.7)',
      color: '#e0e0e0',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '14px',
      lineHeight: '1.6',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(8px)',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'none',
      zIndex: '100',
      textAlign: 'center',
    });
    document.body.appendChild(this.overlay);
  }

  setMeshes(meshes) {
    this._meshes = meshes;
  }

  update(dt, meshToRoomMap) {
    this.raycaster.setFromCamera(CENTER, this.camera);
    const meshes = this._meshes || Array.from(meshToRoomMap.keys());
    const intersects = this.raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
      // Walk up to find the mapped mesh
      let target = intersects[0].object;
      let roomIndex = null;
      while (target) {
        if (meshToRoomMap.has(target)) {
          roomIndex = meshToRoomMap.get(target);
          break;
        }
        target = target.parent;
      }

      if (roomIndex !== null && roomIndex === this.lastTarget) {
        this.gazeTimer += dt;
      } else {
        this.gazeTimer = 0;
        this.lastTarget = roomIndex;
      }

      if (this.gazeTimer >= GAZE_THRESHOLD && roomIndex !== null) {
        const room = this.worldGraph.getRoom(roomIndex);
        if (room) {
          this.currentText = room.sentence;
          this.overlayOpacity = Math.min(1, this.overlayOpacity + dt * FADE_SPEED);
        }
      }
    } else {
      this.gazeTimer = 0;
      this.lastTarget = null;
      this.overlayOpacity = Math.max(0, this.overlayOpacity - dt * FADE_SPEED);
    }

    this.overlay.style.opacity = String(this.overlayOpacity);
    if (this.currentText && this.overlayOpacity > 0) {
      this.overlay.textContent = this.currentText;
    }
    if (this.overlayOpacity <= 0) {
      this.currentText = null;
    }
  }

  dispose() {
    this.overlay.remove();
  }
}
