/**
 * Minimal in-world HUD overlay. Nearly invisible during exploration.
 * ESC shows controls overlay.
 */

export class HUD {
  constructor(onExit) {
    this.onExit = onExit;
    this.container = null;
    this.controlsOverlay = null;
    this.visible = false;
    this._build();

    this._onKeyDown = this._onKeyDown.bind(this);
    document.addEventListener('keydown', this._onKeyDown);
  }

  _build() {
    // Crosshair
    this.crosshair = document.createElement('div');
    Object.assign(this.crosshair.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '4px',
      height: '4px',
      borderRadius: '50%',
      background: 'rgba(255, 255, 255, 0.3)',
      zIndex: '50',
      pointerEvents: 'none',
    });
    document.body.appendChild(this.crosshair);

    // Room info (bottom left)
    this.roomInfo = document.createElement('div');
    Object.assign(this.roomInfo.style, {
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      color: 'rgba(255, 255, 255, 0.3)',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '13px',
      zIndex: '50',
      pointerEvents: 'none',
    });
    this.roomInfo.setAttribute('role', 'status');
    this.roomInfo.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.roomInfo);

    // Controls overlay (shown on ESC)
    this.controlsOverlay = document.createElement('div');
    Object.assign(this.controlsOverlay.style, {
      position: 'fixed',
      inset: '0',
      display: 'none',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(4px)',
      zIndex: '200',
      fontFamily: "'JetBrains Mono', monospace",
      color: '#e0e0e0',
    });

    const controls = [
      ['WASD / Arrows', 'Move'],
      ['Mouse', 'Look around'],
      ['Shift', 'Run'],
      ['Space', 'Float up (in void)'],
      ['Tab', 'Toggle minimap'],
      ['C', 'Cinematic flythrough'],
      ['R', 'Record flythrough'],
      ['ESC', 'This menu'],
    ];

    const title = document.createElement('h2');
    title.textContent = 'Controls';
    title.style.marginBottom = '24px';
    title.style.fontWeight = '300';
    title.style.letterSpacing = '4px';
    this.controlsOverlay.appendChild(title);

    for (const [key, desc] of controls) {
      const row = document.createElement('div');
      row.style.marginBottom = '8px';
      row.style.fontSize = '13px';
      const keySpan = document.createElement('span');
      keySpan.textContent = key;
      keySpan.style.color = 'rgba(100, 180, 255, 0.8)';
      keySpan.style.display = 'inline-block';
      keySpan.style.width = '160px';
      keySpan.style.textAlign = 'right';
      keySpan.style.marginRight = '16px';
      const descSpan = document.createElement('span');
      descSpan.textContent = desc;
      descSpan.style.color = 'rgba(255, 255, 255, 0.6)';
      row.appendChild(keySpan);
      row.appendChild(descSpan);
      this.controlsOverlay.appendChild(row);
    }

    // Resume and Exit buttons
    const btnRow = document.createElement('div');
    btnRow.style.marginTop = '32px';
    btnRow.style.display = 'flex';
    btnRow.style.gap = '16px';

    const resumeBtn = document.createElement('button');
    resumeBtn.textContent = 'Resume (click)';
    resumeBtn.setAttribute('aria-label', 'Resume exploring the world');
    this._styleBtn(resumeBtn);
    resumeBtn.addEventListener('click', () => this.hideControls());

    const exitBtn = document.createElement('button');
    exitBtn.textContent = 'New Text';
    exitBtn.setAttribute('aria-label', 'Return to entry screen with new text');
    this._styleBtn(exitBtn);
    exitBtn.addEventListener('click', () => {
      this.hideControls();
      this.onExit();
    });

    btnRow.appendChild(resumeBtn);
    btnRow.appendChild(exitBtn);
    this.controlsOverlay.appendChild(btnRow);

    document.body.appendChild(this.controlsOverlay);
  }

  _styleBtn(btn) {
    Object.assign(btn.style, {
      padding: '8px 20px',
      background: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '6px',
      color: '#e0e0e0',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '12px',
      cursor: 'pointer',
    });
  }

  _onKeyDown(e) {
    if (e.code === 'Escape') {
      if (this.visible) {
        this.hideControls();
      } else {
        this.showControls();
      }
    }
  }

  showControls() {
    this.visible = true;
    this.controlsOverlay.style.display = 'flex';
    document.exitPointerLock();
  }

  hideControls() {
    this.visible = false;
    this.controlsOverlay.style.display = 'none';
  }

  updateRoomInfo(roomIndex, totalRooms, geometryType) {
    this.roomInfo.textContent = `${geometryType} ${roomIndex + 1}/${totalRooms}`;
  }

  setVisible(v) {
    this.crosshair.style.display = v ? 'block' : 'none';
    this.roomInfo.style.display = v ? 'block' : 'none';
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    this.crosshair?.remove();
    this.roomInfo?.remove();
    this.controlsOverlay?.remove();
  }
}
