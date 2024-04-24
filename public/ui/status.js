import { component, css, html } from "../component.js"
import formatSize from "../formatSize.js"

component(
  `x-status`,
  await css(import.meta.resolve(`./status.css`)),
  function Status({ torrents }) {
    return html`
      <div id="rateDownload">
        ${formatSize(
          torrents.map((t) => t.rateDownload).reduce((a, b) => a + b, 0)
        )}/s
      </div>
      <div id="rateUpload">
        ${formatSize(
          torrents.map((t) => t.rateUpload).reduce((a, b) => a + b, 0)
        )}/s
      </div>
    `
  }
)
