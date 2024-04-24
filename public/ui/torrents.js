import "./setLocation.js"

import { repeat } from "lit-html/directives/repeat.js"

import { component, html, useState, css } from "../component.js"
import ContextMenu from "./torrents/ContextMenu.js"
import FilterSideEffects from "./torrents/FilterSideEffects.js"
import RemoveTorrent from "./torrents/RemoveTorrent.js"
import ScrollIntoView from "./torrents/ScrollIntoView.js"
import Selections from "./torrents/Selections.js"
import Shortcuts from "./torrents/Shortcuts.js"
import * as enums from "../enums.js"
import formatSize from "../formatSize.js"

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
    setShowDetails,
    selections: _selections,
    setSelections,
  }) {
    const [changeLocation, setChangeLocation] = useState(false)
    const selections = Selections.call(this, {
      torrents,
      selections: _selections,
      setSelections,
    })
    const removeTorrent = RemoveTorrent.call(this, { selections })
    const contextMenu = ContextMenu.call(this, {
      selections,
      removeTorrent,
      setShowDetails,
      torrents,
      setChangeLocation,
    })
    Shortcuts.call(this, {
      selections,
      torrents,
      removeTorrent,
      setChangeLocation,
    })
    ScrollIntoView.call(this, { selections })
    FilterSideEffects.call(this, {
      filters,
      showTorrentCount,
      setShowTorrentCount,
      selections,
      totalTorrents,
    })

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
              class="row ${selections.includes(torrent.id)
                ? `selected`
                : ``} ${torrent.errorString ? `error` : ``} ${torrent.isRemoving
                ? `isRemoving`
                : ``}"
              title=${torrent.errorString}
              data-id=${torrent.id}
              @click=${selections.onClickRow}
              @dblclick=${() => setShowDetails(true)}
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
      ${contextMenu.html} ${removeTorrent.html}
      ${!changeLocation
        ? ``
        : html`
            <x-set-location
              .title="Set Location"
              .torrents=${changeLocation.map((id) =>
                torrents.find((t) => t.id === id)
              )}
              .onDone=${() => setChangeLocation(false)}
            >
            </x-set-location>
          `}
    `
  }
)

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
      torrent.error ? torrent.errorString : makeProgress(torrent),
  },
  {
    key: `peersGettingFromUs`,
    name: `Leech`,
    format: (peers, torrent) =>
      `${peers} (${torrent.trackerStats.map((it) => it.leecherCount).reduce((a, b) => Math.max(a, 0) + Math.max(b, 0), 0)})`,
  },
  {
    key: `peersSendingToUs`,
    name: `Seeds`,
    format: (peers, torrent) =>
      `${peers} (${torrent.trackerStats.map((it) => it.seederCount).reduce((a, b) => Math.max(a, 0) + Math.max(b, 0), 0)})`,
  },
  { key: `uploadRatio`, name: `Ratio`, format: (ratio) => ratio.toFixed(1) },
]

function makeProgress(torrent) {
  let progress = 0
  let text
  switch (torrent.status) {
    case enums.SEED:
      progress = 100
      text = enums.friendlyName(torrent.status)
      const speed = torrent.peers
        .map((peer) => peer.rateToPeer)
        .reduce((a, b) => a + b, 0)
      if (speed > 0) {
        text = `▲ ${formatSize(speed)}/s`
      }

      break
    case enums.DOWNLOAD: {
      progress = Math.floor(torrent.percentDone * 100)

      const speed =
        formatSize(
          torrent.peers
            .map((peer) => peer.rateToClient)
            .reduce((a, b) => a + b, 0)
        ) + `/s`

      text = `▼ ${speed} ${progress}%`
      break
    }
    case enums.CHECK:
      progress = Math.round(torrent.recheckProgress * 100)
      text = `Verifying ${progress}%`
      break
    default:
      text = enums.friendlyName(torrent.status)
      progress = 0
      break
  }

  return html`
    <div
      class="progress status-${enums
        .friendlyName(torrent.status)
        .toLowerCase()}"
    >
      <div class="layer">${text}</div>
      <div class="layer">
        <div class="loadbar" style="width: ${progress}%"></div>
      </div>
      <div class="layer" style="clip-path: inset(0 ${100 - progress}% 0 0)">
        ${text}
      </div>
    </div>
  `
}
