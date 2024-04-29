import "./popup.js"

import { component, css, html, useEffect, useState } from "../component.js"
import useConfig from "../useConfig.js"
import * as actions from "../torrentActions.js"

component(
  `x-transfer`,
  await css(import.meta.resolve(`./transfer.css`)),
  function Transfer({ onDone, torrents }) {
    const [disabled, setDisabled] = useState(false)
    const config = useConfig()
    const [status, setStatus] = useState([])

    // make a sticky copy of torrents, as they will change while we transfer
    if (!this._torrents) {
      this._torrents = [...torrents.map((it) => ({ ...it }))]
    } else {
      torrents = this._torrents
    }

    const apply = async () => {
      const targetClientId = this.shadowRoot.querySelector(`select`).value

      if (
        !targetClientId ||
        !config.clients.find((c) => c.id === targetClientId)
      ) {
        alert(`Please select a target client.`)
        return
      }

      setDisabled(true)

      for (const [index, torrent] of torrents.entries()) {
        const statusItem = { copy: null, remove: null }
        status[index] = statusItem
        setStatus([...status])

        const result = await actions.add({
          clientId: targetClientId,
          torrentFile: torrent.torrentFile,
          "download-dir": torrent.downloadDir,
        })

        statusItem.copy = result
        setStatus([...status])

        if (result !== `success`) {
          break
        }

        const removeResult = await actions.remove([torrent.id], false)

        statusItem.remove = removeResult
        setStatus([...status])

        if (removeResult !== `success`) {
          break
        }
      }

      onDone()
    }

    return html`
      <x-popup .title=${`Transfer`} .onDone=${onDone} .disabled=${disabled}>
        <summary>
          Transferring <b>${torrents.length}</b> torrent(s) from
          <b>
            ${torrents
              .map((t) => t.clientId)
              .filter((c, i, a) => a.indexOf(c) === i)
              .join(`, `)}
          </b>
        </summary>
        <label>What client should be the new owner?</label>
        <select>
          <option value=""></option>
          ${(config?.clients || []).map(
            (client) =>
              html` <option value="${client.id}">${client.id}</option>`
          )}
        </select>
        <button ?disabled=${disabled} slot="buttons" @click=${apply}>
          Apply
        </button>
        ${status.length === 0
          ? ``
          : html`
              <div id="status">
                ${torrents.map((_, index) => {
                  const copy = status[index]?.copy
                  const remove = status[index]?.remove

                  return html`
                    <div class="statusItem">
                      <div class="name">${torrents[index].name}</div>
                      <div class="entries">
                        <div
                          class="entry ${!copy
                            ? `working`
                            : copy === `success`
                              ? `success`
                              : `error`}"
                        >
                          Copy from ${torrents[index].clientId}
                        </div>
                        <div
                          class="entry ${!remove
                            ? `working`
                            : remove === `success`
                              ? `success`
                              : `error`}"
                        >
                          Remove from ${torrents[index].clientId}
                        </div>
                      </div>
                    </div>
                  `
                })}
              </div>
            `}
      </x-popup>
    `
  }
)
