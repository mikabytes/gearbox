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
      // Status
      let entry = byStatus.get(t.status)
      if (!entry) {
        entry = {
          id: t.status,
          label: enums.friendlyName(t.status),
          count: 0,
        }
        byStatus.set(t.status, entry)
      }
      entry.count += 1

      // Client
      entry = byClient.get(t.clientId)
      if (!entry) {
        entry = {
          id: t.clientId,
          label: t.clientId[0].toUpperCase() + t.clientId.slice(1),
          count: 0,
        }
        byClient.set(t.clientId, entry)
      }
      entry.count += 1

      // Tracker
      for (const tracker of t.trackers) {
        entry = byTracker.get(tracker.sitename)
        if (!entry) {
          entry = {
            id: tracker.sitename,
            label:
              tracker.sitename[0].toUpperCase() + tracker.sitename.slice(1),
            count: 0,
          }
          byTracker.set(tracker.sitename, entry)
        }
        entry.count += 1
      }

      for (const label of t.labels) {
        entry = byLabel.get(label)
        if (!entry) {
          entry = {
            id: label,
            label: label[0].toUpperCase() + label.slice(1),
            count: 0,
          }
          byLabel.set(label, entry)
        }
        entry.count += 1
      }
    }

    return html`
      ${makeSection(`Status`, `status`, byStatus, filters, setFilters)}
      ${makeSection(`Client`, `clientId`, byClient, filters, setFilters)}
      ${makeSection(
        `Tracker`,
        `trackers[].sitename`,
        byTracker,
        filters,
        setFilters
      )}
      ${makeSection(`Label`, `labels[]`, byLabel, filters, setFilters)}
    `
  }
)

function makeSection(name, key, values, filters, set) {
  let selection = filters[key] || []

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
    set({ ...filters, [key]: selection })
  }

  values = [...values.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .filter(([k, v]) => v.count)
  return html`
    <h1>${name}</h1>
    <section id=${key}>
      ${values.map(
        ([k, { label, count }]) => html`
          <div
            class="selectItem ${selection.some(
              (s) => s == k /* note == enabled comparison with str and num */
            )
              ? `selected`
              : ``}"
            @click=${(e) => onClick(key, k, e.ctrlKey)}
          >
            <div class="name">${label}</div>
            <div></div>
            <div class="count">${count}</div>
          </div>
        `
      )}
    </section>
  `
}
