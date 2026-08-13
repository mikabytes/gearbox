import "./objectExplorer.js"

import { component, html, useState, css } from "../component.js"
import * as enums from "../enums.js"
import formatEta from "../formatEta.js"
import formatSize from "../formatSize.js"

const TABS = [`Overview`, `Files`, `Trackers`, `Peers`, `Raw`]

component(
  `x-details`,
  await css(import.meta.resolve(`./details.css`)),
  function Details({ selectedTorrents }) {
    const [tab, setTab] = useState(`Overview`)

    if (!selectedTorrents.length) {
      return html`<div class="empty">Select a torrent to see its details</div>`
    }

    if (selectedTorrents.length > 1) {
      return summary(selectedTorrents)
    }

    const torrent = selectedTorrents[0]

    return html`
      <div class="tabs" role="tablist">
        ${TABS.map(
          (name) => html`
            <button
              role="tab"
              class=${name === tab ? `active` : ``}
              aria-selected=${name === tab}
              @click=${() => setTab(name)}
            >
              ${name}
            </button>
          `
        )}
      </div>
      <div class="content">${renderTab(tab, torrent)}</div>
    `
  }
)

function renderTab(tab, torrent) {
  switch (tab) {
    case `Files`:
      return files(torrent)
    case `Trackers`:
      return trackers(torrent)
    case `Peers`:
      return peers(torrent)
    case `Raw`:
      return html`<x-object-explorer
        .selectedTorrents=${[torrent]}
      ></x-object-explorer>`
    default:
      return overview(torrent)
  }
}

function overview(torrent) {
  const percent = Math.round((torrent.percentDone ?? 0) * 100)
  const isComplete = (torrent.percentDone ?? 0) >= 1
  const have =
    (torrent.haveValid ?? 0) + (torrent.haveUnchecked ?? 0) ||
    Math.floor(
      (torrent.percentDone ?? 0) *
        (torrent.sizeWhenDone || torrent.totalSize || 0)
    )
  const eta =
    torrent.status === enums.DOWNLOAD && torrent.eta > 0
      ? formatEta(torrent.eta)
      : ``
  const date = (seconds) =>
    seconds ? new Date(seconds * 1000).toLocaleString() : ``

  const facts = [
    [`Status`, enums.friendlyName(torrent.status)],
    [`Size`, formatSize(torrent.sizeWhenDone ?? torrent.totalSize ?? 0)],
    [
      `Have`,
      `${formatSize(have)} (${Math.floor((torrent.percentDone ?? 0) * 1000) / 10}%)`,
    ],
    [`Downloaded`, formatSize(torrent.downloadedEver ?? 0)],
    [`Uploaded`, formatSize(torrent.uploadedEver ?? 0)],
    [`Ratio`, (torrent.uploadRatio ?? 0).toFixed(2)],
    [`ETA`, eta],
    [
      `Speed`,
      torrent.rateDownload || torrent.rateUpload
        ? `▼ ${formatSize(torrent.rateDownload ?? 0)}/s  ▲ ${formatSize(torrent.rateUpload ?? 0)}/s`
        : ``,
    ],
    [
      `Peers`,
      `${torrent.peersConnected ?? 0} connected (${torrent.peersSendingToUs ?? 0} seeding to us, ${torrent.peersGettingFromUs ?? 0} leeching)`,
    ],
    [`Location`, torrent.downloadDir],
    [`Client`, torrent.clientId],
    [`Labels`, (torrent.labels ?? []).join(`, `)],
    [`Added`, date(torrent.addedDate)],
    [`Completed`, date(torrent.doneDate)],
    [`Hash`, torrent.hashString],
  ].filter(([, value]) => value !== `` && value != null)

  return html`
    <header>
      <h2 title=${torrent.name}>${torrent.name}</h2>
      ${torrent.errorString
        ? html`<div class="error-banner">${torrent.errorString}</div>`
        : ``}
    </header>
    <div class="progressbar ${isComplete ? `complete` : ``}">
      <div class="fill" style="width: ${percent}%"></div>
      <span>${percent}%</span>
    </div>
    <dl class="facts">
      ${facts.map(
        ([label, value]) => html`
          <div class="fact">
            <dt>${label}</dt>
            <dd title=${value}>${value}</dd>
          </div>
        `
      )}
    </dl>
  `
}

function files(torrent) {
  const files = torrent.files ?? []
  if (!files.length) {
    return html`<div class="empty">No file information available</div>`
  }
  return html`
    <table>
      <thead>
        <tr>
          <th class="grow">Name</th>
          <th>Size</th>
          <th>Done</th>
        </tr>
      </thead>
      <tbody>
        ${files.map((file, index) => {
          const wanted = torrent.fileStats?.[index]?.wanted !== false
          const percent = file.length
            ? Math.floor((file.bytesCompleted / file.length) * 100)
            : 0
          return html`
            <tr class=${wanted ? `` : `skipped`}>
              <td class="grow" title=${file.name}>${file.name}</td>
              <td>${formatSize(file.length ?? 0)}</td>
              <td>${wanted ? `${percent}%` : `skip`}</td>
            </tr>
          `
        })}
      </tbody>
    </table>
  `
}

function trackers(torrent) {
  const stats = torrent.trackerStats ?? []
  if (!stats.length) {
    return html`<div class="empty">No trackers</div>`
  }
  return html`
    <table>
      <thead>
        <tr>
          <th class="grow">Tracker</th>
          <th>Seeds</th>
          <th>Leech</th>
          <th class="grow">Last announce</th>
        </tr>
      </thead>
      <tbody>
        ${stats.map(
          (tracker) => html`
            <tr>
              <td class="grow" title=${tracker.announce ?? ``}>${tracker.announce ?? ``}</td>
              <td>${Math.max(tracker.seederCount ?? -1, -1) < 0 ? `?` : tracker.seederCount}</td>
              <td>${Math.max(tracker.leecherCount ?? -1, -1) < 0 ? `?` : tracker.leecherCount}</td>
              <td
                class="grow ${/^error\b/i.test(tracker.lastAnnounceResult ?? ``) ? `announce-error` : ``}"
                title=${tracker.lastAnnounceResult ?? ``}
              >
                ${tracker.lastAnnounceResult ?? ``}
              </td>
            </tr>
          `
        )}
      </tbody>
    </table>
  `
}

function peers(torrent) {
  const peers = torrent.peers ?? []
  if (!peers.length) {
    return html`<div class="empty">No connected peers</div>`
  }
  return html`
    <table>
      <thead>
        <tr>
          <th class="grow">Address</th>
          <th class="grow">Client</th>
          <th>Done</th>
          <th>Down</th>
          <th>Up</th>
        </tr>
      </thead>
      <tbody>
        ${peers.map(
          (peer) => html`
            <tr>
              <td class="grow">${peer.address ?? ``}</td>
              <td class="grow" title=${peer.clientName ?? ``}>${peer.clientName ?? ``}</td>
              <td>${Math.round((peer.progress ?? 0) * 100)}%</td>
              <td>${peer.rateToClient ? `${formatSize(peer.rateToClient)}/s` : ``}</td>
              <td>${peer.rateToPeer ? `${formatSize(peer.rateToPeer)}/s` : ``}</td>
            </tr>
          `
        )}
      </tbody>
    </table>
  `
}

function summary(torrents) {
  const totalSize = torrents.reduce((a, t) => a + (t.totalSize ?? 0), 0)
  const rateDownload = torrents.reduce((a, t) => a + (t.rateDownload ?? 0), 0)
  const rateUpload = torrents.reduce((a, t) => a + (t.rateUpload ?? 0), 0)
  const complete = torrents.filter((t) => (t.percentDone ?? 0) >= 1).length

  const facts = [
    [`Selected`, `${torrents.length} torrents`],
    [`Total size`, formatSize(totalSize)],
    [`Completed`, `${complete} of ${torrents.length}`],
    [
      `Speed`,
      rateDownload || rateUpload
        ? `▼ ${formatSize(rateDownload)}/s  ▲ ${formatSize(rateUpload)}/s`
        : ``,
    ],
  ].filter(([, value]) => value !== ``)

  return html`
    <div class="content">
      <dl class="facts">
        ${facts.map(
          ([label, value]) => html`
            <div class="fact">
              <dt>${label}</dt>
              <dd>${value}</dd>
            </div>
          `
        )}
      </dl>
    </div>
  `
}
