import { repeat } from "lit-html/directives/repeat.js"
import {
  component,
  html,
  useMemo,
  useState,
  useEffect,
  css,
} from "../../component.js"
import { friendlyName } from "../../enums.js"

component(
  `x-torrents`,
  await css(import.meta.resolve(`./torrents.css`)),
  function Torrents({ torrents: allTorrents, sort, setSort, filters }) {
    const [contextMenu, setContextMenu] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showTorrentCount, setShowTorrentCount] = useState(50)
    const [selections, setSelections] = useState([])
    const [progress, setProgress] = useState(false)
    const torrents = allTorrents.slice(0, showTorrentCount)

    useEffect(() => {
      const keydown = (e) => {
        if (e.key === `ArrowDown`) {
          e.preventDefault()
          // move selection down
          for (let i = 0; i < torrents.length; i++) {
            if (torrents[i].id === selections[selections.length - 1]) {
              if (i + 1 < torrents.length) {
                if (e.shiftKey) {
                  setSelections([...selections, torrents[i + 1].id])
                } else {
                  setSelections([torrents[i + 1].id])
                }
              }
            }
          }
        } else if (e.key === `ArrowUp`) {
          e.preventDefault()
          for (let i = 0; i < torrents.length; i++) {
            if (torrents[i].id === selections[selections.length - 1]) {
              if (i - 1 >= 0) {
                if (e.shiftKey) {
                  setSelections([...selections, torrents[i - 1].id])
                } else {
                  setSelections([torrents[i - 1].id])
                }
              }
            }
          }
          return
        }
      }
      this.addEventListener(`keydown`, keydown)
      return () => {
        this.removeEventListener(`keydown`, keydown)
      }
    }, [torrents, selections])

    useEffect(() => {
      const lastSelectedRow = this.shadowRoot.querySelector(
        `.row[data-id="${selections[selections.length - 1]}"]`
      )

      lastSelectedRow?.scrollIntoView({ block: `start` })
    }, [selections])

    useEffect(() => {
      function removeContextMenu() {
        setContextMenu(false)
        setIsDeleting(false)
      }
      document.addEventListener(`click`, removeContextMenu)

      return () => {
        document.removeEventListener(`click`, removeContextMenu)
      }
    }, [contextMenu])

    useEffect(() => {
      if (contextMenu) {
        this.shadowRoot.querySelector(`#context-menu`).focus()
      }
    }, [contextMenu])

    useEffect(() => {
      this.shadowRoot.querySelector(`.container`).scrollTop = 0
      setShowTorrentCount(100)
      setSelections([])
    }, [filters])

    useEffect(() => {
      let div = this.shadowRoot.querySelector(`.container`)
      const onScroll = () => {
        if (div.scrollTop + div.offsetHeight >= div.scrollHeight - 100) {
          if (showTorrentCount < this.torrents.length) {
            setShowTorrentCount(
              Math.min(this.torrents.length, showTorrentCount * 2)
            )
          }
        }
      }
      div.addEventListener(`scroll`, onScroll)
      return () => {
        div.removeEventListener(`scroll`, onScroll)
      }
    }, [showTorrentCount])

    function setSelection(e, _id) {
      const id = _id || +this.dataset.id

      if (!e.shiftKey && !e.ctrlKey) {
        setSelections([id])
        return
      }

      if (e.ctrlKey) {
        if (selections.includes(id)) {
          setSelections(selections.filter((k) => k !== id))
        } else {
          setSelections([...selections, id])
        }
        return
      }

      if (e.shiftKey) {
        let startIndex = torrents.findIndex((t) => t.id === id)
        let stopIndex = torrents.findIndex(
          (t) => t.id === selections[selections.length - 1]
        )

        if (startIndex > stopIndex) {
          ;[startIndex, stopIndex] = [stopIndex, startIndex]
        }

        setSelections([
          ...new Set(
            selections.concat(
              torrents.slice(startIndex, stopIndex + 1).map((t) => t.id)
            )
          ),
        ])
      }
    }

    async function removeTorrents(deleteLocalFiles = false) {
      setProgress(true)
      const res = await fetch(`/transmission/rpc`, {
        method: `POST`,
        headers: {
          "Content-Type": `application/json`,
        },
        body: JSON.stringify({
          method: `torrent-remove`,
          arguments: {
            ids: selections,
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
      setSelections([])
      setIsDeleting(false)
    }

    return html` <div class="container">
        <div class="row headers">
          ${columns.map(
            ({ key, name }) => html`
              <div
                class="header ${key} ${key === sort.key
                  ? `sorted ${sort.reverse ? `reverse` : ``}`
                  : ``}"
                @click=${() =>
                  setSort({
                    key,
                    reverse: key === sort.key ? !sort.reverse : true,
                  })}
              >
                ${name}
              </div>
            `
          )}
        </div>
        ${repeat(
          torrents,
          (t) => t.id,
          (torrent, index) =>
            html`<div
              class="row ${selections.includes(torrent.id)
                ? `selected`
                : ``} ${torrent.errorString ? `error` : ``} ${torrent.isRemoving
                ? `isRemoving`
                : ``}"
              title=${torrent.errorString}
              data-id=${torrent.id}
              @click=${setSelection}
              @contextmenu=${(e) => {
                if (!selections.includes(torrent.id)) {
                  setSelections([torrent.id])
                }
                e.preventDefault()
                setContextMenu([e.pageX, e.pageY])
              }}
              @touchstart=${(e) => {
                e.preventDefault()
                this.longPressTimer = setTimeout(
                  () => setContextMenu([0, 0]),
                  500
                )
              }}
              @touchend=${() => clearTimeout(this.longPressTimer)}
              @touchmove=${() => clearTimeout(this.longPressTimer)}
              @touchcancel=${() => clearTimeout(this.longPressTimer)}
            >
              ${columns.map(
                ({ key, name, format }) =>
                  html`<div class="${key}">
                    ${format(torrent[key], torrent)}
                  </div>`
              )}
            </div>`
        )}
      </div>
      ${!contextMenu
        ? html``
        : html`
            <div
              id="context-menu"
              tabindex="-1"
              @click=${(e) => e.stopPropagation()}
              style="left: ${contextMenu[0]}px; top: ${contextMenu[1]}px;"
            >
              <button
                @mousedown=${() => {
                  setContextMenu(false)
                  setIsDeleting(true)
                }}
              >
                Remove
              </button>
            </div>
          `}
      ${!isDeleting
        ? html``
        : html` <div class="grayout">
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
                <b>${selections.length}</b> torrents?
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
                    removeTorrents(
                      this.shadowRoot.querySelector(`#delete-with-data`).checked
                    )}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>`}`
  }
)

function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024 / 1024).toFixed(1)} T`
  }

  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} G`
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} M`
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} K`
  }

  return `${bytes} B`
}

const columns = [
  {
    key: `addedDate`,
    name: `Added`,
    format: (date) => new Date(date * 1000).toISOString().split(`T`)[0],
  },
  { key: `name`, name: `Name`, format: (name) => name },
  { key: `totalSize`, name: `Size`, format: (size) => formatSize(size) },
  {
    key: `status`,
    name: `Progress`,
    format: (status, torrent) =>
      torrent.error ? torrent.errorString : friendlyName(status),
  },
  {
    key: `peersGettingFromUs`,
    name: `Seeds`,
    format: (peers, torrent) => `${peers} (${torrent.peers.length})`,
  },
  {
    key: `peersSendingToUs`,
    name: `Peers`,
    format: (peers, torrent) => `${peers} (${torrent.peers.length})`,
  },
  { key: `uploadRatio`, name: `Ratio`, format: (ratio) => ratio.toFixed(1) },
]