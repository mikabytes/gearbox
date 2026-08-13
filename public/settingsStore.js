// Persistent UI settings (column visibility/widths, theme, appearance).
// Kept outside any component so every consumer sees the same state.

const KEY = `gearboxSettings`

const hasStorage = typeof localStorage !== `undefined`

let settings = load()
const listeners = new Set()

function load() {
  if (!hasStorage) {
    return {}
  }
  try {
    return JSON.parse(localStorage[KEY]) ?? {}
  } catch (e) {
    return {}
  }
}

// Shallow-merges the patch; object values merge one level deep so callers
// can update a single column or appearance knob without clobbering the rest.
export function mergeSettings(base, patch) {
  const next = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === `object` && !Array.isArray(value)) {
      next[key] = { ...base[key], ...value }
    } else {
      next[key] = value
    }
  }
  return next
}

export function getSettings() {
  return settings
}

export function updateSettings(patch) {
  settings = mergeSettings(settings, patch)
  if (hasStorage) {
    localStorage[KEY] = JSON.stringify(settings)
  }
  for (const listener of listeners) {
    listener(settings)
  }
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
