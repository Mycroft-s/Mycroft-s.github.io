import assert from 'node:assert/strict';
import test from 'node:test';
import { initTabs } from '../assets/js/modules/tabs.js';
import { initSkills } from '../assets/js/modules/skills.js';
import { initNavigation } from '../assets/js/modules/navigation.js';
import { initContact } from '../assets/js/modules/contact.js';

// Exercise controller transitions at the DOM boundary; real button keys/layout
// are verified in the browser, without a second DOM or UI framework dependency.
function element(classes = []) {
  const names = new Set(classes);
  const attrs = new Map();
  const events = new Map();
  return {
    classList: {
      contains: name => names.has(name),
      toggle(name, value) { value ? names.add(name) : names.delete(name); },
    },
    dataset: {}, textContent: '', hidden: false, disabled: false,
    getAttribute: name => attrs.get(name) ?? null,
    setAttribute: (name, value) => attrs.set(name, value),
    removeAttribute: name => attrs.delete(name),
    addEventListener(name, callback) { events.set(name, [...events.get(name) || [], callback]); },
    async emit(name, event = {}) { for (const fn of events.get(name) || []) await fn(event); },
    focus() { this.focused = true; },
    select() { this.selected = true; },
  };
}

test('experience keyboard navigation synchronizes focus, selected tabs and hidden panels', async () => {
  const work = element(['qualification__active']); work.dataset.target = '#work';
  const education = element(); education.dataset.target = '#education';
  const panels = [element(), element()]; panels[0].id = 'work'; panels[1].id = 'education';
  const container = { querySelectorAll: selector => selector.includes('button') ? [work, education] : panels };
  const root = { querySelectorAll: () => [container] };
  initTabs(root);
  assert.equal(panels[1].hidden, true);
  let prevented = false;
  await work.emit('keydown', { key: 'ArrowRight', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(education.focused, true);
  assert.equal(education.tabIndex, 0);
  assert.equal(work.tabIndex, -1);
  assert.equal(education.getAttribute('aria-selected'), 'true');
  assert.equal(panels[0].hidden, true);
  assert.equal(panels[1].hidden, false);
  await education.emit('keydown', { key: 'ArrowRight', preventDefault() {} });
  assert.equal(work.getAttribute('aria-selected'), 'true');
  assert.equal(work.focused, true);
});

test('collapsed skill groups hide their interactive descendants and retain one open group', async () => {
  const groups = [element(['skills__open']), element(['skills__close'])];
  for (const group of groups) {
    group.button = element(); group.list = element();
    group.querySelector = selector => selector === '.skills__header' ? group.button : group.list;
    group.querySelectorAll = () => [];
  }
  const section = { querySelectorAll: () => groups };
  initSkills({ querySelector: () => section });
  assert.equal(groups[1].list.hidden, true);
  await groups[1].button.emit('click');
  assert.equal(groups[0].list.hidden, true);
  assert.equal(groups[1].list.hidden, false);
  assert.equal(groups[1].button.getAttribute('aria-expanded'), 'true');
  await groups[1].button.emit('click');
  assert.equal(groups[1].list.hidden, true);
  assert.equal(groups[1].button.getAttribute('aria-expanded'), 'false');
});

test('mobile menu removes closed links from focus and Escape restores the toggle', async () => {
  const menu = element(), toggle = element(), close = element(), link = element();
  menu.id = 'nav-menu'; menu.querySelector = () => link;
  const root = element();
  root.getElementById = id => ({ 'nav-menu': menu, 'nav-toggle': toggle, 'nav-close': close })[id];
  root.querySelectorAll = () => [];
  const media = element(); media.matches = true;
  const view = { matchMedia: () => media, addEventListener() {}, innerHeight: 800, scrollY: 0 };
  initNavigation(root, view);
  assert.equal(menu.inert, true);
  await toggle.emit('click');
  assert.equal(menu.inert, false);
  assert.equal(link.focused, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  await root.emit('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(menu.inert, true);
  assert.equal(toggle.focused, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  media.matches = false;
  await media.emit('change');
  assert.equal(menu.inert, false);
  assert.equal(menu.getAttribute('aria-hidden'), null);
});

function contactPage() {
  const nodes = Object.fromEntries(['contact-copy-email', 'contact-email', 'contact-copy-status', 'contact-copy-fallback', 'contact-copy-field'].map(id => [id, element()]));
  nodes['contact-email'].textContent = 'person@example.com';
  return {
    nodes,
    getElementById: id => nodes[id],
    querySelector: selector => ({ textContent: selector.includes('contact__copied') ? 'Copied.' : 'Select the email below.' }),
  };
}

test('email copy awaits the clipboard result before reporting success', async () => {
  const root = contactPage();
  let finish; let value;
  initContact(root, { writeText: text => { value = text; return new Promise(resolve => { finish = resolve; }); } });
  const pending = root.nodes['contact-copy-email'].emit('click');
  assert.equal(value, 'person@example.com');
  assert.equal(root.nodes['contact-copy-email'].disabled, true);
  assert.equal(root.nodes['contact-copy-status'].textContent, '');
  finish(); await pending;
  assert.equal(root.nodes['contact-copy-status'].textContent, 'Copied.');
  assert.equal(root.nodes['contact-copy-email'].disabled, false);
  assert.equal(root.nodes['contact-copy-fallback'].hidden, true);
});

test('denied clipboard permission exposes and selects the address without false success', async () => {
  const root = contactPage();
  initContact(root, { writeText: async () => { throw new Error('NotAllowedError'); } });
  await root.nodes['contact-copy-email'].emit('click');
  assert.equal(root.nodes['contact-copy-status'].textContent, 'Select the email below.');
  assert.equal(root.nodes['contact-copy-fallback'].hidden, false);
  assert.equal(root.nodes['contact-copy-field'].value, 'person@example.com');
  assert.equal(root.nodes['contact-copy-field'].focused, true);
  assert.equal(root.nodes['contact-copy-field'].selected, true);
});
