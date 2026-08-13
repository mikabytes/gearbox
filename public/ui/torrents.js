import "./setLocation.js"
import "./transfer.js"

import { repeat } from "lit-html/directives/repeat.js"

import { component, html, useState, useEffect, css } from "../component.js"
import ContextMenu from "./torrents/ContextMenu.js"
import FilterSideEffects from "./torrents/FilterSideEffects.js"
import RemoveTorrent from "./torrents/RemoveTorrent.js"
import ScrollIntoView from "./torrents/ScrollIntoView.js"
import Selections from "./torrents/Selections.js"
import Shortcuts from "./torrents/Shortcuts.js"
import * as enums from "../enums.js"
import formatEta from "../formatEta.js"
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
    const [transfer, setTransfer] = useState(null)
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
      setTransfer,
    })
    Shortcuts.call(this, {
      selections,
      torrents,
      removeTorrent,
      setChangeLocation,
      supports: contextMenu.supports,
    })
    ScrollIntoView.call(this, { selections })
    FilterSideEffects.call(this, {
      filters,
      showTorrentCount,
      setShowTorrentCount,
      selections,
      totalTorrents,
    })

    useEffect(() => {
      this.addEventListener(
        "touchmove",
        (e) => {
          clearTimeout(this.longPressTimer)
        },
        { passive: true }
      )
    }, [])

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
                if (e.cancelable) {
                  e.preventDefault()
                }
                this.longPressTimer = setTimeout(
                  () =>
                    contextMenu.show(e.touches[0].pageX, e.touches[0].pageY),
                  500
                )
              }}
              @touchend=${() => clearTimeout(this.longPressTimer)}
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
              .torrents=${changeLocation.map((id) =>
                torrents.find((t) => t.id === id)
              )}
              .onDone=${() => setChangeLocation(false)}
            >
            </x-set-location>
          `}
      ${!transfer
        ? ``
        : html`
            <x-transfer
              .torrents=${transfer.map((id) =>
                torrents.find((t) => t.id === id)
              )}
              .onDone=${() => setTransfer(false)}
            >
            </x-transfer>
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
    key: `haveValid`,
    name: `Have`,
    format: (haveValid, torrent) => {
      // some clients don't report verified bytes; fall back to progress
      const have =
        (haveValid ?? 0) + (torrent.haveUnchecked ?? 0) ||
        Math.floor(
          (torrent.percentDone ?? 0) *
            (torrent.sizeWhenDone || torrent.totalSize || 0)
        )
      return formatSize(have)
    },
  },
  {
    key: `status`,
    name: `Progress`,
    format: (status, torrent) =>
      torrent.error ? torrent.errorString : makeProgress(torrent),
  },
  {
    key: `eta`,
    name: `ETA`,
    format: (eta, torrent) => {
      if (torrent.status !== enums.DOWNLOAD) {
        return ``
      }
      if (!(eta > 0) && torrent.rateDownload > 0) {
        const left =
          torrent.leftUntilDone > 0
            ? torrent.leftUntilDone
            : Math.max(
                0,
                (torrent.sizeWhenDone || torrent.totalSize || 0) *
                  (1 - (torrent.percentDone ?? 0))
              )
        if (left > 0) {
          eta = left / torrent.rateDownload
        }
      }
      return eta > 0 ? formatEta(eta) : ``
    },
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
  // The bar always shows how much of the torrent we have, so completion is
  // visible at a glance no matter the status. The color says complete vs
  // incomplete; the text says what the torrent is doing right now.
  const isComplete = (torrent.percentDone ?? 0) >= 1
  let progress = Math.floor((torrent.percentDone ?? 0) * 100)
  let text
  switch (torrent.status) {
    case enums.SEED:
      text = enums.friendlyName(torrent.status)
      const speed = torrent.rateUpload
      if (speed > 0) {
        text = `▲ ${formatSize(speed)}/s`
      }

      break
    case enums.DOWNLOAD: {
      const speed = formatSize(torrent.rateDownload) + `/s`

      text = `▼ ${speed} ${progress}%`
      break
    }
    case enums.CHECK:
      progress = Math.round(torrent.recheckProgress * 100)
      text = `Verifying ${progress}%`
      break
    case enums.STOPPED:
      text = isComplete
        ? enums.friendlyName(torrent.status)
        : `${enums.friendlyName(torrent.status)} ${progress}%`
      break
    default:
      text = enums.friendlyName(torrent.status)
      break
  }

  return html`
    <div
      class="progress ${isComplete ? `complete` : `incomplete`} status-${enums
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
