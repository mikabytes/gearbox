import styles from "./styles.js"
import { repeat } from "lit/directives/repeat.js"
import {
  component,
  html,
  useMemo,
  useState,
  useEffect,
} from "../../component.js"

const columns = [
  {
    key: `addedDate`,
    name: `Added`,
    format: (date) => new Date(date * 1000).toISOString().split(`T`)[0],
  },
  { key: `name`, name: `Name`, format: (name) => name },
  { key: `totalSize`, name: `Size`, format: (size) => formatSize(size) },
  { key: `isSeeding`, name: `Progress`, format: (isSeeding) => isSeeding },
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

component(
  `x-torrents`,
  styles,
  function Torrents({ torrents: allTorrents, sort, setSort, filters }) {
    const [showTorrentCount, setShowTorrentCount] = useState(100)
    const [selections, setSelections] = useState([])
    const torrents = allTorrents.slice(0, showTorrentCount)

    useEffect(() => {
      this.shadowRoot.querySelector(`.container`).scrollTop = 0
      setShowTorrentCount(100)
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

    function setSelection(e) {
      const id = this.dataset.id

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

        setSelections(
          selections.concat(
            torrents.slice(startIndex, stopIndex + 1).map((t) => t.id)
          )
        )
      }
    }

    return html`
      <div class="container">
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
              class="row ${selections.includes(torrent.id) ? `selected` : ``}"
              data-id=${torrent.id}
              @click=${setSelection}
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
    `
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
