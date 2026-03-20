/**
 * Automated spline flythrough camera with optional video recording.
 * Press C to toggle cinematic mode.
 */
import * as THREE from 'three';

export class CinematicMode {
  constructor(camera, worldGraph) {
    this.camera = camera;
    this.worldGraph = worldGraph;
    this.active = false;
    this.progress = 0;
    this.speed = 0.03; // fraction per second
    this.spline = null;
    this.lookSpline = null;
    this.recorder = null;
    this.isRecording = false;

    this._buildSpline();
  }

  _buildSpline() {
    const nodes = this.worldGraph.getOrderedNodes();
    if (nodes.length < 2) return;

    // Camera path: slightly above and offset from room centers
    const points = nodes.map(n => new THREE.Vector3(
      n.position.x + 2,
      (n.type === 'void' ? 4 : 3),
      n.position.z + 2
    ));
    this.spline = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);

    // Look-at targets: room centers
    const lookPoints = nodes.map(n => new THREE.Vector3(
      n.position.x,
      1.5,
      n.position.z
    ));
    this.lookSpline = new THREE.CatmullRomCurve3(lookPoints, false, 'catmullrom', 0.5);
  }

  toggle() {
    this.active = !this.active;
    if (this.active) {
      this.progress = 0;
    }
  }

  startRecording(canvas) {
    if (!this.active || this.isRecording) return;
    try {
      const stream = canvas.captureStream(30);
      this.recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      this.recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'synesthesia-flythrough.webm';
        a.click();
        URL.revokeObjectURL(url);
      };
      this.recorder.start();
      this.isRecording = true;
    } catch (e) {
      console.warn('Recording unavailable:', e);
    }
  }

  stopRecording() {
    if (this.recorder && this.isRecording) {
      this.recorder.stop();
      this.isRecording = false;
    }
  }

  update(dt) {
    if (!this.active || !this.spline) return false;

    this.progress += this.speed * dt;
    if (this.progress >= 1) {
      this.progress = 1;
      this.active = false;
      this.stopRecording();
      return false;
    }

    const pos = this.spline.getPointAt(this.progress);
    const lookAt = this.lookSpline.getPointAt(Math.min(this.progress + 0.02, 1));

    this.camera.position.copy(pos);
    this.camera.lookAt(lookAt);

    return true; // still active — skip player controller
  }

  isActive() {
    return this.active;
  }

  dispose() {
    this.stopRecording();
  }
}
