import "./setLocation.js"
import "./transfer.js"

import { repeat } from "lit-html/directives/repeat.js"

import { component, html, useState, useEffect, css } from "../component.js"
import ContextMenu from "./torrents/ContextMenu.js"
import { columns, gridTemplate, visibleColumns } from "./torrents/columns.js"
import FilterSideEffects from "./torrents/FilterSideEffects.js"
import RemoveTorrent from "./torrents/RemoveTorrent.js"
import ScrollIntoView from "./torrents/ScrollIntoView.js"
import Selections from "./torrents/Selections.js"
import Shortcuts from "./torrents/Shortcuts.js"
import * as torrentActions from "../torrentActions.js"
import useSettings from "../useSettings.js"

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
    const [settings, updateSettings] = useSettings()
    const [liveWidths, setLiveWidths] = useState(null)
    const visible = visibleColumns(columns, settings)
    const widths = liveWidths ?? settings.columnWidths ?? {}

    const startResize = (e, column) => {
      e.preventDefault()
      e.stopPropagation()
      const handle = e.currentTarget
      const startX = e.clientX
      const base = Math.max(
        45,
        (settings.columnWidths ?? {})[column.key] ?? column.width
      )
      let last = base
      const move = (ev) => {
        last = Math.max(45, base + ev.clientX - startX)
        setLiveWidths({ ...(settings.columnWidths ?? {}), [column.key]: last })
      }
      const up = () => {
        window.removeEventListener(`pointermove`, move)
        window.removeEventListener(`pointerup`, up)
        setLiveWidths(null)
        updateSettings({ columnWidths: { [column.key]: last } })
      }
      try {
        handle.setPointerCapture(e.pointerId)
      } catch (err) {
        // synthetic pointers can't always be captured; window listeners
        // below track the drag either way
      }
      window.addEventListener(`pointermove`, move)
      window.addEventListener(`pointerup`, up)
    }
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

    const selectedIds = selections.getIds()
    const selectedTorrents = torrents.filter((t) => selectedIds.includes(t.id))
    const pauseSelected = () =>
      torrentActions.pause(
        selectedTorrents.filter((t) => t.status !== 0).map((t) => t.id)
      )
    const resumeSelected = () =>
      torrentActions.resume(
        selectedTorrents.filter((t) => t.status === 0).map((t) => t.id)
      )

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
      <div
        class="container"
        style="grid-template-columns: ${gridTemplate(visible, widths)}"
      >
        <div class="row headers">
          ${visible.map(
            (column) => html`
              <div
                class="header ${column.key} ${column.key === sort.key
                  ? `sorted ${sort.reverse ? `reverse` : ``}`
                  : ``}"
                @click=${() =>
                  setSort({
                    key: column.key,
                    reverse: column.key === sort.key ? !sort.reverse : true,
                  })}
              >
                ${column.name}
                <div
                  class="resize-handle"
                  @pointerdown=${(e) => startResize(e, column)}
                  @click=${(e) => e.stopPropagation()}
                ></div>
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
              ${visible.map(
                ({ key, format }) =>
                  html`<div class="${key}">
                    ${format(torrent[key], torrent)}
                  </div>`
              )}
            </div>`
        )}
      </div>
      ${!selectedIds.length
        ? ``
        : html`
            <div class="action-bar">
              <span class="count">${selectedIds.length}</span>
              <button @click=${resumeSelected}>▶ Resume</button>
              <button @click=${pauseSelected}>⏸ Pause</button>
              <button @click=${() => setShowDetails(true)}>Details</button>
              <button
                class="danger"
                @click=${() => removeTorrent.remove(selectedIds)}
              >
                Remove
              </button>
              <button
                class="clear"
                aria-label="Clear selection"
                @click=${() => selections.reset()}
              >
                ✕
              </button>
            </div>
          `}
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
