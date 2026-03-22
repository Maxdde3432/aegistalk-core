// Lightweight toast helper without extra deps
export const toast = {
  success: (message, opts = {}) => showToast(message, { tone: 'success', ...opts }),
  error: (message, opts = {}) => showToast(message, { tone: 'error', ...opts })
};

const showToast = (message, { duration = 2600, tone = 'success', position = 'bottom-right' } = {}) => {
  if (typeof document === 'undefined') return;

  const containerId = `toast-container-${position}`;
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.position = 'fixed';
    container.style.zIndex = '9999';
    container.style.pointerEvents = 'none';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    if (position.includes('bottom')) container.style.bottom = '20px';
    if (position.includes('top')) container.style.top = '20px';
    if (position.includes('right')) container.style.right = '20px';
    if (position.includes('left')) container.style.left = '20px';
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  toastEl.textContent = message;
  toastEl.style.pointerEvents = 'auto';
  toastEl.style.padding = '12px 14px';
  toastEl.style.borderRadius = '12px';
  const isSuccess = tone === 'success';
  toastEl.style.background = isSuccess ? 'rgba(46, 204, 113, 0.14)' : 'rgba(255, 99, 99, 0.14)';
  toastEl.style.color = isSuccess ? '#d8f7e6' : '#ffd7d7';
  toastEl.style.border = isSuccess ? '1px solid rgba(126,225,139,0.35)' : '1px solid rgba(255,120,120,0.4)';
  toastEl.style.backdropFilter = 'blur(6px)';
  toastEl.style.boxShadow = '0 10px 30px rgba(0,0,0,0.35)';
  toastEl.style.fontSize = '13px';
  toastEl.style.fontWeight = '600';
  toastEl.style.display = 'flex';
  toastEl.style.alignItems = 'center';
  toastEl.style.gap = '10px';
  toastEl.style.transform = 'translateY(20px)';
  toastEl.style.opacity = '0';
  toastEl.style.transition = 'transform 200ms ease, opacity 200ms ease';
  const icon = isSuccess ? '✓' : '⚠';
  const iconBg = isSuccess ? 'rgba(126,225,139,0.25)' : 'rgba(255,120,120,0.25)';
  const iconBorder = isSuccess ? 'rgba(126,225,139,0.35)' : 'rgba(255,120,120,0.4)';
  const iconColor = isSuccess ? '#7ee18b' : '#ff9f9f';
  toastEl.innerHTML = `<span style="width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;background:${iconBg};border-radius:50%;border:1px solid ${iconBorder};color:${iconColor};">${icon}</span><span>${message}</span>`;

  container.appendChild(toastEl);

  requestAnimationFrame(() => {
    toastEl.style.transform = 'translateY(0)';
    toastEl.style.opacity = '1';
  });

  const remove = () => {
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (toastEl.parentNode === container) {
        container.removeChild(toastEl);
        if (!container.childElementCount) container.remove();
      }
    }, 200);
  };

  setTimeout(remove, duration);
  return remove;
};
