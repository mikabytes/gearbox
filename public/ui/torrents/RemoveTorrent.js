import { useState, html } from "../../component.js"
import * as torrentActions from "../../torrentActions.js"

export default function RemoveTorrent({ selections }) {
  const [ids, setIds] = useState(false)
  const isDeleting = !!ids

  function remove(ids) {
    setIds(ids)
  }

  function reset() {
    setIds(false)
  }

  const removeTorrentHtml = html`
    ${!isDeleting
      ? html``
      : html`
          <div class="grayout">
            <div
              id="delete-confirm"
              tabindex="-1"
              @click=${(e) => e.stopPropagation()}
              @keydown=${(e) => {
                console.log(e)
                if (e.key === `Escape`) {
                  reset()
                }
              }}
            >
              <div>
                Are you sure you want to remove
                <b>${selections.getIds().length}</b> torrents?
              </div>

              <label>
                <input type="checkbox" id="delete-with-data" ?checked=${true} />
                Also delete local files
              </label>

              <div class="options">
                <button @click=${reset}>Cancel</button>
                <button
                  @click=${() =>
                    execute(
                      this.shadowRoot.querySelector(`#delete-with-data`).checked
                    )}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        `}
  `

  async function execute(deleteLocalFiles = false) {
    torrentActions.remove(selections.getIds(), deleteLocalFiles)
    selections.reset()
    reset()
  }

  return { remove, reset, html: removeTorrentHtml }
}
