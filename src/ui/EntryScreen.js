/**
 * Entry screen: dark void background with text input and "Materialize" button.
 */

const SAMPLE_TEXTS = [
  `The cathedral of thought rises in silence, each archway a question left unanswered. Light filters through crystalline memories, painting the floor in hues of forgotten conversations.

Here the corridors narrow, whispering secrets in languages that taste of copper and starlight. Doors open to rooms that breathe — expanding with hope, contracting with doubt.

At the edge of understanding, the architecture dissolves into mist. Particles of meaning drift outward, connecting to structures not yet imagined. The void between ideas hums with potential, electric and patient.`,
];

export class EntryScreen {
  constructor(onMaterialize) {
    this.onMaterialize = onMaterialize;
    this.container = null;
    this._build();
  }

  _build() {
    this.container = document.createElement('div');
    this.container.id = 'entry-screen';
    Object.assign(this.container.style, {
      position: 'fixed',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, #0a0a1a 0%, #000 70%)',
      zIndex: '1000',
      fontFamily: "'JetBrains Mono', monospace",
    });

    // Title
    const title = document.createElement('h1');
    title.textContent = 'Synesthesia Engine';
    Object.assign(title.style, {
      color: '#e0e0e0',
      fontSize: '28px',
      fontWeight: '300',
      letterSpacing: '6px',
      textTransform: 'uppercase',
      marginBottom: '8px',
    });

    const subtitle = document.createElement('p');
    subtitle.textContent = 'translate text into navigable worlds';
    Object.assign(subtitle.style, {
      color: 'rgba(255, 255, 255, 0.3)',
      fontSize: '12px',
      letterSpacing: '3px',
      marginBottom: '32px',
    });

    // Text area
    this.textarea = document.createElement('textarea');
    this.textarea.placeholder = 'Paste your text here...';
    this.textarea.value = '';
    this.textarea.maxLength = 10000;
    this.textarea.setAttribute('aria-label', 'Enter text to materialize into a 3D world');
    Object.assign(this.textarea.style, {
      width: '600px',
      maxWidth: '90vw',
      height: '200px',
      padding: '16px',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: '#e0e0e0',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '13px',
      lineHeight: '1.6',
      resize: 'vertical',
      outline: 'none',
    });
    this.textarea.addEventListener('focus', () => {
      this.textarea.style.borderColor = 'rgba(255, 255, 255, 0.25)';
    });
    this.textarea.addEventListener('blur', () => {
      this.textarea.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    });

    // Character counter
    this.charCounter = document.createElement('div');
    Object.assign(this.charCounter.style, {
      width: '600px',
      maxWidth: '90vw',
      textAlign: 'right',
      color: 'rgba(255, 255, 255, 0.2)',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '11px',
      marginTop: '4px',
    });
    this.charCounter.textContent = '0/10,000';
    this.textarea.addEventListener('input', () => {
      const len = this.textarea.value.length;
      this.charCounter.textContent = `${len.toLocaleString()}/10,000`;
      this.charCounter.style.color = len > 9500
        ? 'rgba(255, 200, 80, 0.6)'
        : 'rgba(255, 255, 255, 0.2)';
    });

    // Button row
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, {
      display: 'flex',
      gap: '12px',
      marginTop: '20px',
      alignItems: 'center',
    });

    // Sample text button
    const sampleBtn = document.createElement('button');
    sampleBtn.textContent = 'Try Sample';
    sampleBtn.setAttribute('aria-label', 'Load sample text');
    this._styleButton(sampleBtn, true);
    sampleBtn.addEventListener('click', () => {
      this.textarea.value = SAMPLE_TEXTS[0];
      this.textarea.dispatchEvent(new Event('input'));
    });

    // Materialize button
    this.materializeBtn = document.createElement('button');
    this.materializeBtn.innerHTML = '&#9670; Materialize';
    this.materializeBtn.setAttribute('aria-label', 'Materialize text into a 3D world');
    this._styleButton(this.materializeBtn, false);
    this.materializeBtn.addEventListener('click', () => {
      const text = this.textarea.value.trim();
      if (!text || text.length > 10000) return;
      this.hide();
      this.onMaterialize(text);
    });

    btnRow.appendChild(sampleBtn);
    btnRow.appendChild(this.materializeBtn);

    // Controls hint
    const hint = document.createElement('p');
    hint.textContent = 'WASD to move  |  Mouse to look  |  Tab for minimap  |  C for cinematic  |  ESC for menu';
    Object.assign(hint.style, {
      color: 'rgba(255, 255, 255, 0.2)',
      fontSize: '12px',
      marginTop: '24px',
      letterSpacing: '1px',
    });

    this.container.appendChild(title);
    this.container.appendChild(subtitle);
    this.container.appendChild(this.textarea);
    this.container.appendChild(this.charCounter);
    this.container.appendChild(btnRow);
    this.container.appendChild(hint);

    document.body.appendChild(this.container);
  }

  _styleButton(btn, isSecondary) {
    Object.assign(btn.style, {
      padding: '10px 24px',
      background: isSecondary ? 'transparent' : 'rgba(255, 255, 255, 0.08)',
      border: `1px solid rgba(255, 255, 255, ${isSecondary ? '0.1' : '0.2'})`,
      borderRadius: '6px',
      color: '#e0e0e0',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '13px',
      cursor: 'pointer',
      letterSpacing: '2px',
      transition: 'all 0.2s',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.background = isSecondary
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(255, 255, 255, 0.15)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.4)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = isSecondary ? 'transparent' : 'rgba(255, 255, 255, 0.08)';
      btn.style.borderColor = `rgba(255, 255, 255, ${isSecondary ? '0.1' : '0.2'})`;
    });
  }

  /** Pre-fill text (e.g. from URL) */
  setText(text) {
    this.textarea.value = text;
    this.textarea.dispatchEvent(new Event('input'));
  }

  hide() {
    if (this.container) {
      this.container.style.opacity = '0';
      this.container.style.transition = 'opacity 0.5s';
      setTimeout(() => {
        this.container.style.display = 'none';
      }, 500);
    }
  }

  show() {
    if (this.container) {
      this.container.style.display = 'flex';
      this.container.style.opacity = '1';
    }
  }

  dispose() {
    this.container?.remove();
  }
}
