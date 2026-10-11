const initialized = new WeakSet();

/** A failed Clipboard API request exposes a selectable address, never a success notice. */
export function initContact(root = document, clipboard = globalThis.navigator?.clipboard) {
  const button = root.getElementById('contact-copy-email');
  const address = root.getElementById('contact-email');
  const status = root.getElementById('contact-copy-status');
  const fallback = root.getElementById('contact-copy-fallback');
  const field = root.getElementById('contact-copy-field');
  if (!button || !address || !status || !fallback || !field || initialized.has(button)) return;
  initialized.add(button);
  button.hidden = false;

  let statusKey = '';
  const renderStatus = () => {
    status.textContent = statusKey
      ? root.querySelector(`#contact-copy-messages [i18n="${statusKey}"]`)?.textContent.trim() || ''
      : '';
  };

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    const email = address.textContent.trim();
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    statusKey = '';
    renderStatus();
    fallback.hidden = true;
    try {
      if (typeof clipboard?.writeText !== 'function') throw new Error('Clipboard unavailable');
      await clipboard.writeText(email);
      statusKey = 'contact__copied';
    } catch {
      statusKey = 'contact__copy_failed';
      field.value = email;
      fallback.hidden = false;
      field.focus();
      field.select();
    } finally {
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
      renderStatus();
    }
  });

  if (typeof MutationObserver === 'function') {
    new MutationObserver(renderStatus).observe(root.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
}
