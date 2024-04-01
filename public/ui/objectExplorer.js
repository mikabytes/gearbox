import { component, html, css } from "../component.js"

function createHtml(obj, indentLevel = 0) {
  if (obj === null) {
    return html`<b>null</b>`
  }

  if (obj === undefined) {
    return html`<b>undefined</b>`
  }

  if (Array.isArray(obj)) {
    return html`[${obj.map((o) => createHtml(o, indentLevel + 1))}]`
  }

  if (typeof obj === "object") {
    return Object.keys(obj).map(
      (k) =>
        html`<div style="margin-left: ${indentLevel * 10}px">
          ${k}: ${createHtml(obj[k], indentLevel + 1)}
        </div>`
    )
  }

  return html`<b style="margin-left: ${indentLevel * 10}px">${obj}</b>`
}

component(
  `x-object-explorer`,
  await css(import.meta.resolve(`./objectExplorer.css`)),
  function ObjectExplorer({ obj }) {
    return html`${JSON.stringify(obj, null, 4)}`
  }
)
