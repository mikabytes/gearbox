import "./popup.js"

import { component, css, html } from "../component.js"
import { setLocation } from "../torrentActions.js"

component(
  `x-set-location`,
  await css(import.meta.resolve(`./setLocation.css`)),
  function SetLocation({ onDone, torrents }) {
    let path = torrents[0].downloadDir

    for (const t of torrents) {
      if (t.downloadDir !== path) {
        path = ``
        break
      }
    }

    const apply = async () => {
      await setLocation(
        torrents.map((t) => t.id),
        this.shadowRoot.querySelector(`input`).value
      )
      onDone()
    }

    return html`
      <x-popup .title=${`Set Location`} .onDone=${onDone}>
        <input type="text" value=${path} />
        <button slot="buttons" @click=${apply}>Apply</button>
      </x-popup>
    `
  }
)
