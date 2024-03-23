import styles from "./styles.js"
import { component, html, useState, useMemo } from "../../component.js"
import * as enums from "../../enums.js"

component(
  `x-sidebar`,
  styles,
  function Sidebar({ torrents, filters, setFilters }) {
    let byStatus = new Map()
    let byClient = new Map()
    let byTracker = new Map()
    let byLabel = new Map()

    for (const t of torrents) {
      byStatus.set(
        enums.friendlyName(t.status),
        (byStatus.get(enums.friendlyName(t.status)) || 0) + 1
      )
      byClient.set(t.clientId, (byClient.get(t.clientId) || 0) + 1)

      for (const tracker of t.trackers) {
        byTracker.set(
          tracker.sitename,
          (byTracker.get(tracker.sitename) || 0) + 1
        )
      }

      for (const label of t.labels) {
        byLabel.set(label, (byLabel.get(label) || 0) + 1)
      }
    }

    return html`
      ${makeSection(`Status`, `status`, byStatus, filters.status, setFilters)}
      ${makeSection(
        `Client`,
        `clientId`,
        byClient,
        filters.clientId,
        setFilters
      )}
      ${makeSection(
        `Tracker`,
        `trackers[].sitename`,
        byTracker,
        filters[`trackers[].sitename`],
        setFilters
      )}
      ${makeSection(
        `Label`,
        `labels[]`,
        byLabel,
        filters[`labels[]`],
        setFilters
      )}
    `
  }
)

function makeSection(name, key, values, selection, set) {
  selection ||= []

  function onClick(key, value, ctrlKey) {
    if (selection.includes(value)) {
      selection = selection.filter((v) => v !== value)
    } else {
      if (ctrlKey) {
        selection = [...selection, value]
      } else {
        selection = [value]
      }
    }
    set({ [key]: selection })
  }

  values = [...values.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([k, v]) => v)
  return html`
    <h1>${name}</h1>
    <section id=${key}>
      ${values.map(
        ([k, v]) => html`
          <div
            class="selectItem ${selection.includes(k) ? `selected` : ``}"
            @click=${(e) => onClick(key, k, e.ctrlKey)}
          >
            <div class="name">${k[0].toUpperCase() + k.slice(1)}</div>
            <div></div>
            <div class="count">${v}</div>
          </div>
        `
      )}
    </section>
  `
}
