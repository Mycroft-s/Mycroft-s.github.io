const initialized = new WeakSet();

export function initTabs(root = document) {
  for (const container of root.querySelectorAll('.qualification__container')) {
    if (initialized.has(container)) continue;
    initialized.add(container);
    const tabs = [...container.querySelectorAll('.qualification__button[data-target]')];
    const panels = [...container.querySelectorAll('.qualification__content[data-content]')];

    const activate = (tab, moveFocus = false) => {
      // Match IDs without interpolating unvalidated values into a CSS selector.
      const panel = panels.find(item => `#${item.id}` === tab.dataset.target);
      if (!panel) return;
      for (const item of panels) {
        item.classList.toggle('qualification__active', item === panel);
        item.hidden = item !== panel;
      }
      for (const item of tabs) {
        item.classList.toggle('qualification__active', item === tab);
        item.setAttribute('aria-selected', String(item === tab));
        item.tabIndex = item === tab ? 0 : -1;
      }
      if (moveFocus) tab.focus();
    };

    if (tabs.length) activate(tabs.find(tab => tab.classList.contains('qualification__active')) || tabs[0]);
    for (const tab of tabs) {
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', event => {
        let index = tabs.indexOf(tab);
        if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') index = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = tabs.length - 1;
        else return;
        event.preventDefault();
        activate(tabs[index], true);
      });
    }
    root.addEventListener?.('click', event => {
      if (event.target.closest('[data-qualification-work]')) {
        const workTab = tabs.find(tab => tab.dataset.target === '#work');
        if (workTab) activate(workTab);
      }
    });
  }
}
