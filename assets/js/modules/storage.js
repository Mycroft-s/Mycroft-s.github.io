// Preferences should never prevent the page from working in private/restricted
// browsing contexts where localStorage access can throw.
export function readPreference(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writePreference(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // The current page still reflects the preference even if it cannot be saved.
  }
}
