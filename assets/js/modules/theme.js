import { readPreference, writePreference } from './storage.js';

const initialized = new WeakSet();

export function initTheme(root = document) {
  const button = root.getElementById('theme-button');
  if (!button || initialized.has(button)) return;
  initialized.add(button);

  const setTheme = dark => {
    root.body.classList.toggle('dark-theme', dark);
    button.classList.toggle('uil-sun', dark);
  };
  const selected = readPreference('selected-theme');
  setTheme(selected ? selected === 'dark' : root.body.classList.contains('dark-theme'));

  button.addEventListener('click', () => {
    const dark = !root.body.classList.contains('dark-theme');
    setTheme(dark);
    writePreference('selected-theme', dark ? 'dark' : 'light');
    // Retain the existing key/value convention for returning visitors.
    writePreference('selected-icon', dark ? 'uil-moon' : 'uil-sun');
  });
}
