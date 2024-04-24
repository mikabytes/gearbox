import "./status.js"
import "./header.js"
import "./sidebar.js"
import "./torrents.js"
import "./objectExplorer.js"
import "./addTorrents.js"
import "./announcer.js"
import fileToTorrent from "../fileToTorrent.js"

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
    const [showSidebar, setShowSidebar] = useState(window.innerWidth > 575)
    const [showTorrentCount, setShowTorrentCount] = useState(100)
    const [showDetails, setShowDetails] = useState(false)
    const [sort, _setSort] = useState(
      initialSort || { key: `addedDate`, reverse: true }
    )
    const [selections, setSelections] = useState([])
    const [torrentsToAdd, setTorrentsToAdd] = useState(null)

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
    const selectedTorrents = useMemo(() => {
      return torrents.filter((t) => selections.includes(t.id))
    }, [torrents, selections])
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

    // drag and drop .torrent files
    const [dragging, setDragging] = useState(false)
    useEffect(() => {
      this.addEventListener(
        `dragenter`,
        (e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragging(true)
        },
        false
      )
      this.addEventListener(
        `dragover`,
        (e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragging(true)
        },
        false
      )
      this.addEventListener(
        `dragleave`,
        (e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragging(false)
        },
        false
      )
      this.addEventListener(
        `drop`,
        (e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragging(false)
          let files = []
          for (const file of e.dataTransfer.files) {
            let isTorrent = false

            if (file.type) {
              isTorrent = file.type === `application/x-bittorrent`
            } else {
              // on windows, no browser is filling in the type, so we fallback to checking the name
              isTorrent = file.name.endsWith(`.torrent`)
            }
            if (isTorrent) {
              files.push(file)
            }
          }

          if (files.length) {
            const promise = Promise.all(files.map(fileToTorrent))
            promise.then((all) => {
              setTorrentsToAdd(all)
            })
            promise.catch((err) => {
              console.error(err)
              alert(err.message)
            })
          }
        },
        false
      )
    }, [])

    return html`
      <x-announcer></x-announcer>
      <x-header
        .filters=${filters}
        .setFilters=${setFilters}
        .selectedTorrents=${selectedTorrents}
        .setTorrentsToAdd=${setTorrentsToAdd}
        .toggleSidebar=${() => setShowSidebar(!showSidebar)}
      ></x-header>
      ${!showSidebar
        ? ``
        : html`<x-sidebar
            .torrents=${allTorrents}
            .filters=${filters}
            .setFilters=${setFilters}
            .selectedTorrents=${selectedTorrents}
          ></x-sidebar>`}
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
        .selections=${selections}
        .setSelections=${setSelections}
      ></x-torrents>
      <div id="drag-ver"></div>
      <div id="footer" class="${showDetails ? `show` : `hide`}">
        ${!showDetails
          ? ``
          : html`<x-object-explorer
              .selectedTorrents=${selectedTorrents}
            ></x-object-explorer>`}
        <button @click=${() => setShowDetails(false)}>✕</button>
      </div>
      <x-status .torrents=${allTorrents}></x-status>
      ${!dragging
        ? ``
        : html`<div id="dragging"><div>Drop files here</div></div>`}
      ${!torrentsToAdd
        ? ``
        : html`
            <x-add-torrents
              .done=${() => setTorrentsToAdd(null)}
              .torrentsToAdd=${torrentsToAdd}
              .setTorrentsToAdd=${setTorrentsToAdd}
            ></x-add-torrents>
          `}
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
