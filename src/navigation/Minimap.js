/**
 * Top-down minimap showing WorldGraph layout and player position.
 * Toggle with Tab key.
 */

export class Minimap {
  constructor(worldGraph) {
    this.worldGraph = worldGraph;
    this.visible = false;
    this._lastX = null;
    this._lastZ = null;

    this.canvas = document.createElement('canvas');
    this.canvas.width = 200;
    this.canvas.height = 200;
    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '16px',
      right: '16px',
      width: '200px',
      height: '200px',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      zIndex: '90',
      display: 'none',
      pointerEvents: 'none',
    });
    this.ctx = this.canvas.getContext('2d');
    document.body.appendChild(this.canvas);

    this._onKeyDown = this._onKeyDown.bind(this);
    document.addEventListener('keydown', this._onKeyDown);
  }

  _onKeyDown(e) {
    if (e.code === 'Tab') {
      e.preventDefault();
      this.visible = !this.visible;
      this.canvas.style.display = this.visible ? 'block' : 'none';
    }
  }

  update(playerX, playerZ) {
    if (!this.visible) return;

    // Skip redraw if player hasn't moved significantly
    if (this._lastX !== null) {
      const dx = playerX - this._lastX;
      const dz = playerZ - this._lastZ;
      if (dx * dx + dz * dz < 0.25) return;
    }
    this._lastX = playerX;
    this._lastZ = playerZ;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Compute bounds of world
    const rooms = this.worldGraph.rooms;
    const voids = this.worldGraph.voids;
    if (rooms.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const r of rooms) {
      minX = Math.min(minX, r.position.x);
      maxX = Math.max(maxX, r.position.x);
      minZ = Math.min(minZ, r.position.z);
      maxZ = Math.max(maxZ, r.position.z);
    }
    for (const v of voids) {
      minX = Math.min(minX, v.position.x);
      maxX = Math.max(maxX, v.position.x);
      minZ = Math.min(minZ, v.position.z);
      maxZ = Math.max(maxZ, v.position.z);
    }

    const padding = 30;
    const rangeX = (maxX - minX) || 1;
    const rangeZ = (maxZ - minZ) || 1;
    const scaleF = Math.min((w - padding * 2) / rangeX, (h - padding * 2) / rangeZ);

    const toScreenX = (x) => padding + (x - minX) * scaleF;
    const toScreenZ = (z) => padding + (z - minZ) * scaleF;

    // Draw edges
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    for (const edge of this.worldGraph.edges) {
      const fromNode = edge.from.type === 'room' ? rooms[edge.from.index] : voids[edge.from.index];
      const toNode = edge.to.type === 'room' ? rooms[edge.to.index] : voids[edge.to.index];
      if (!fromNode || !toNode) continue;
      ctx.beginPath();
      ctx.moveTo(toScreenX(fromNode.position.x), toScreenZ(fromNode.position.z));
      ctx.lineTo(toScreenX(toNode.position.x), toScreenZ(toNode.position.z));
      ctx.stroke();
    }

    // Draw rooms
    for (const room of rooms) {
      const sx = toScreenX(room.position.x);
      const sz = toScreenZ(room.position.z);
      const size = 3 + room.scale;
      ctx.fillStyle = 'rgba(100, 180, 255, 0.6)';
      ctx.fillRect(sx - size / 2, sz - size / 2, size, size);
    }

    // Draw voids
    for (const v of voids) {
      const sx = toScreenX(v.position.x);
      const sz = toScreenZ(v.position.z);
      ctx.fillStyle = 'rgba(180, 100, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(sx, sz, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw player
    const px = toScreenX(playerX);
    const pz = toScreenZ(playerZ);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px, pz, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, pz, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    this.canvas.remove();
    this._lastX = null;
    this._lastZ = null;
  }
}
