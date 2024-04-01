import "./header.js"
import "./sidebar.js"
import "./torrents.js"
import "./objectExplorer.js"

import {
  component,
  html,
  useEffect,
  useMemo,
  useState,
  css,
} from "../../component.js"
import { filtersToStr, strToFilters } from "../../filterStrLib.js"
import filterTorrents from "../../filterTorrents.js"
import useTorrents from "../../useTorrents.js"

let initialSort = null

try {
  initialSort = JSON.parse(localStorage.sort)
} catch (e) {}

component(
  `x-main`,
  await css(import.meta.resolve(`./main.css`)),
  function Main() {
    const [selectedId, setSelectedId] = useState(null)
    const [showTorrentCount, setShowTorrentCount] = useState(100)
    const [_showDetails, setShowDetails] = useState(false)
    const [sort, _setSort] = useState(
      initialSort || { key: `addedDate`, reverse: true }
    )
    const [filters, _setFilters] = useState(
      strToFilters(decodeURIComponent(document.location.hash.slice(1)))
    )
    const setFilters = useMemo(
      () => (filters) => {
        for (const key of Object.keys(filters)) {
          const val = filters[key]
          if (!val?.length) {
            delete filters[key]
          }
        }
        _setFilters(filters)
      },
      [filters]
    )
    const [db, isLoading] = useTorrents()
    const showDetails = _showDetails && db.has(selectedId)

    if (isLoading) {
      const { finished, total } = isLoading
      const progress = total ? finished / total : 0
      const circumference = 200 * Math.PI

      return html`<div class="curtain">
        <div class="progress-container">
          <svg class="progress-ring" width="200" height="200">
            <circle
              class="progress-ring__circle"
              stroke="var(--primary)"
              stroke-width="4"
              style="stroke-dasharray: ${circumference} ${circumference}; stroke-dashoffset: ${circumference -
              progress * circumference}"
              fill="transparent"
              r="90"
              cx="100"
              cy="100"
            />
          </svg>
          <div class="label">Loading</div>
        </div>
      </div>`
    }

    useEffect(() => {
      document.location.hash = filtersToStr(filters)
    }, [filters])

    const allTorrents = db.values().filter(filterTorrents(filters))
    const torrents = memoSlicer(allTorrents, showTorrentCount)
    const totalTorrents = allTorrents.length

    const setSort = useMemo(() => {
      const ret = ({ key, reverse }) => {
        localStorage.sort = JSON.stringify({ key, reverse })
        db.sort((a, b) => {
          if (a[key] > b[key]) {
            return reverse ? -1 : 1
          }
          if (a[key] < b[key]) {
            return reverse ? 1 : -1
          }

          // secondary sort by name
          if (a.name > b.name) {
            return 1
          }
          if (a.name < b.name) {
            return -1
          }
          return 0
        })
        _setSort({ key, reverse })
      }
      // set initial sorting
      ret(sort)
      return ret
    }, [_setSort])

    return html`
      <x-header .filters=${filters} .setFilters=${setFilters}></x-header>
      <x-sidebar
        .torrents=${allTorrents}
        .filters=${filters}
        .setFilters=${setFilters}
      ></x-sidebar>
      <div id="drag-hor"></div>
      <x-torrents
        tabindex="3"
        .showTorrentCount=${showTorrentCount}
        .setShowTorrentCount=${setShowTorrentCount}
        .setSort=${setSort}
        .sort=${sort}
        .totalTorrents=${totalTorrents}
        .torrents=${torrents}
        .filters=${filters}
        .setShowDetails=${setShowDetails}
        .setSelectedId=${setSelectedId}
      ></x-torrents>
      <div id="drag-ver"></div>
      <div id="footer" class="${showDetails ? `show` : `hide`}">
        ${!showDetails
          ? ``
          : html`<x-object-explorer
              .obj=${db.get(selectedId)}
            ></x-object-explorer>`}
        <button @click=${() => setShowDetails(false)}>✕</button>
      </div>
    `
  }
)

let memoSlicerMemory = null
function memoSlicer(array, sliceLength) {
  const subset = array.slice(0, sliceLength)

  if (memoSlicerMemory && memoSlicerMemory.length === subset.length) {
    // compare each object to see if they have changed
    for (let i = 0; i < subset.length; i++) {
      if (subset[i] !== memoSlicerMemory[i]) {
        memoSlicerMemory = subset
        return subset
      }
    }

    // all objects are the same, return memory
    return memoSlicerMemory
  }

  memoSlicerMemory = subset
  return subset
}
