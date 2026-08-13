// Applies the selected theme and appearance overrides to the document root.
// Custom properties (and scrollbar-*) inherit from :root into every shadow
// tree, so this is the single place where theming touches the DOM.
import { getSettings, subscribe } from "./settingsStore.js"

export const themes = [
  { id: `classic`, name: `Classic` },
  { id: `gearbox-dark`, name: `Gearbox Dark` },
  { id: `gearbox-light`, name: `Gearbox Light` },
]

function apply(settings) {
  const root = document.documentElement
  const theme = themes.find((t) => t.id === settings.theme) ?? themes[0]
  root.dataset.theme = theme.id

  const appearance = settings.appearance ?? {}

  if (appearance.radius != null) {
    root.style.setProperty(`--radius`, `${appearance.radius}px`)
    root.style.setProperty(
      `--radius-s`,
      `${Math.max(0, appearance.radius - 2)}px`
    )
  } else {
    root.style.removeProperty(`--radius`)
    root.style.removeProperty(`--radius-s`)
  }

  if (appearance.scrollbar) {
    root.style.setProperty(`--scrollbar-width`, appearance.scrollbar)
  } else {
    root.style.removeProperty(`--scrollbar-width`)
  }
}

apply(getSettings())
subscribe(apply)
