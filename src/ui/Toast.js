/**
 * Simple toast notification overlay matching the dark/monospace aesthetic.
 */

const TOAST_DURATION = 3000;

const SEVERITY_COLORS = {
  info: 'rgba(100, 180, 255, 0.9)',
  warn: 'rgba(255, 200, 80, 0.9)',
  error: 'rgba(255, 100, 100, 0.9)',
};

let activeToast = null;
let dismissTimer = null;
let removeTimer = null;

export function showToast(message, severity = 'info') {
  if (dismissTimer) clearTimeout(dismissTimer);
  if (removeTimer) clearTimeout(removeTimer);
  if (activeToast) {
    activeToast.remove();
    activeToast = null;
  }

  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 20px',
    background: 'rgba(0, 0, 0, 0.85)',
    border: `1px solid ${SEVERITY_COLORS[severity] || SEVERITY_COLORS.info}`,
    borderRadius: '6px',
    color: SEVERITY_COLORS[severity] || SEVERITY_COLORS.info,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12px',
    zIndex: '9999',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.3s',
  });
  el.textContent = message;
  el.setAttribute('role', 'alert');

  document.body.appendChild(el);
  activeToast = el;

  requestAnimationFrame(() => { el.style.opacity = '1'; });

  dismissTimer = setTimeout(() => {
    el.style.opacity = '0';
    removeTimer = setTimeout(() => {
      el.remove();
      if (activeToast === el) activeToast = null;
    }, 300);
  }, TOAST_DURATION);
}
