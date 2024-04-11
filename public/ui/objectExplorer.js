import { component, html, css } from "../component.js"
import formatSize from "../formatSize.js"

component(
  `x-object-explorer`,
  await css(import.meta.resolve(`./objectExplorer.css`)),
  function ObjectExplorer({ selectedTorrents }) {
    if (!selectedTorrents.length) {
      return html``
    }

    if (selectedTorrents.length === 1) {
      return html`${JSON.stringify(selectedTorrents[0], null, 4)}`
    }

    const items = [
      `Selected: ${selectedTorrents.length}`,
      `Total size: ${formatSize(selectedTorrents.map((t) => t.totalSize).reduce((a, b) => a + b, 0))}`,
    ]

    return html`${items.map((item) => `  ${item}`).join(`\n`)}`
  }
)
