import styles from "./styles.js"
import { component, html, useMemo } from "component"

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

component(`x-torrents`, styles, function Torrents({ torrents, sort, setSort }) {
  torrents = torrents.slice(0, 100)

  return html`
    <div class="row">
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
    ${torrents.map(
      (torrent) => html`
        <div class="row">
          ${columns.map(
            ({ key, name, format }) =>
              html`<div class="${key}">${format(torrent[key], torrent)}</div>`
          )}
        </div>
      `
    )}
  `
})

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
