import { useState, html } from "../../component.js"

export default function RemoveTorrent({ selections }) {
  const [progress, setProgress] = useState(false)
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
                if (e.key === `Escape`) {
                  setIsDeleting(false)
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
                <button
                  ?disabled=${progress}
                  @click=${() => setIsDeleting(false)}
                >
                  Cancel
                </button>
                <button
                  ?disabled=${progress}
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
    setProgress(true)
    const res = await fetch(`/transmission/rpc`, {
      method: `POST`,
      headers: {
        "Content-Type": `application/json`,
      },
      body: JSON.stringify({
        method: `torrent-remove`,
        arguments: {
          ids: selections.getIds(),
          "delete-local-data": deleteLocalFiles,
        },
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      console.error(error)
      alert(error)
      return
    }

    setProgress(false)
    selections.reset()
    reset()
  }

  return { remove, reset, html: removeTorrentHtml }
}
