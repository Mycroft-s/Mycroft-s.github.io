const initialized = new WeakSet();

export function initTabs(root = document) {
  for (const container of root.querySelectorAll('.qualification__container')) {
    if (initialized.has(container)) continue;
    initialized.add(container);
    const tabs = [...container.querySelectorAll('.qualification__button[data-target]')];
    const panels = [...container.querySelectorAll('.qualification__content[data-content]')];

    for (const tab of tabs) {
      tab.addEventListener('click', () => {
        // Match IDs without interpolating unvalidated values into a CSS selector.
        const panel = panels.find(item => `#${item.id}` === tab.dataset.target);
        if (!panel) return;
        for (const item of panels) item.classList.toggle('qualification__active', item === panel);
        for (const item of tabs) item.classList.toggle('qualification__active', item === tab);
      });
    }
  }
}
