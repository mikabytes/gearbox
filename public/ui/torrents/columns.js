import { html } from "../../component.js"

export { visibleColumns, gridTemplate } from "./columnLayout.js"
import * as enums from "../../enums.js"
import formatEta from "../../formatEta.js"
import formatSize from "../../formatSize.js"

// Column catalog for the torrent table. `width` is the default in px
// (the name column flexes); visibility and user-resized widths live in
// the settings store.
export const columns = [
  {
    key: `addedDate`,
    name: `Added`,
    width: 85,
    format: (date) => new Date(date * 1000).toISOString().split(`T`)[0],
  },
  { key: `name`, name: `Name`, width: 200, required: true, format: (name) => name },
  {
    key: `totalSize`,
    name: `Size`,
    width: 80,
    format: (size) => formatSize(size),
  },
  {
    key: `haveValid`,
    name: `Have`,
    width: 85,
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
    width: 130,
    format: (status, torrent) =>
      torrent.error ? torrent.errorString : makeProgress(torrent),
  },
  {
    key: `eta`,
    name: `ETA`,
    width: 75,
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
    width: 70,
    format: (peers, torrent) =>
      `${peers} (${torrent.trackerStats.map((it) => it.leecherCount).reduce((a, b) => Math.max(a, 0) + Math.max(b, 0), 0)})`,
  },
  {
    key: `peersSendingToUs`,
    name: `Seeds`,
    width: 70,
    format: (peers, torrent) =>
      `${peers} (${torrent.trackerStats.map((it) => it.seederCount).reduce((a, b) => Math.max(a, 0) + Math.max(b, 0), 0)})`,
  },
  {
    key: `uploadRatio`,
    name: `Ratio`,
    width: 65,
    format: (ratio) => ratio.toFixed(1),
  },
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
