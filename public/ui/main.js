import "./header.js"
import "./sidebar.js"
import "./torrents.js"

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

    const torrents = db.values().filter(filterTorrents(filters))

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
        .torrents=${torrents}
        .filters=${filters}
        .setFilters=${setFilters}
      ></x-sidebar>
      <div id="drag-hor"></div>
      <x-torrents
        tabindex="3"
        .setSort=${setSort}
        .sort=${sort}
        .torrents=${torrents}
        .filters=${filters}
      ></x-torrents>
      <div id="drag-ver"></div>
      <div id="footer">footer</div>
    `
  }
)
