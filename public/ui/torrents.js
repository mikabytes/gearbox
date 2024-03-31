import { repeat } from "lit-html/directives/repeat.js"
import {
  component,
  html,
  useMemo,
  useState,
  useEffect,
  css,
} from "../component.js"
import { friendlyName } from "../enums.js"

import KeyPress from "./torrents/KeyPress.js"
import ScrollIntoView from "./torrents/ScrollIntoView.js"
import ContextMenu from "./torrents/ContextMenu.js"
import FilterSideEffects from "./torrents/FilterSideEffects.js"
import Selections from "./torrents/Selections.js"
import RemoveTorrent from "./torrents/RemoveTorrent.js"

component(
  `x-torrents`,
  await css(import.meta.resolve(`./torrents.css`)),
  function Torrents({
    totalTorrents,
    torrents,
    sort,
    setSort,
    filters,
    showTorrentCount,
    setShowTorrentCount,
  }) {
    const selections = Selections.call(this, {
      torrents,
    })
    const removeTorrent = RemoveTorrent.call(this, { selections })
    const contextMenu = ContextMenu.call(this, {
      selections,
      removeTorrent,
    })
    KeyPress.call(this, { selections, torrents })
    ScrollIntoView.call(this, { selections })
    FilterSideEffects.call(this, {
      filters,
      showTorrentCount,
      setShowTorrentCount,
      selections,
      totalTorrents,
    })

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
              @click=${selections.onClickRow}
              @contextmenu=${(e) => {
                if (!selections.includes(torrent.id)) {
                  selections.set([torrent.id])
                }
                e.preventDefault()
                contextMenu.show(e.pageX, e.pageY)
              }}
              @touchstart=${(e) => {
                e.preventDefault()
                this.longPressTimer = setTimeout(
                  () => contextMenu.show(0, 0),
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
      ${contextMenu.html} ${removeTorrent.html}`
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
