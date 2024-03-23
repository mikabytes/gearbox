import "../sidebar/index.js"
import "../torrents/index.js"
import "../header/index.js"
import styles from "./styles.js"
import { component, html, useState, useMemo } from "../../component.js"
import useTorrents from "../../useTorrents.js"
import filterTorrents from "../../filterTorrents.js"

let initialSort = null

try {
  initialSort = JSON.parse(localStorage.sort)
} catch (e) {}

component(`x-main`, styles, function Main() {
  const [sort, _setSort] = useState(
    initialSort || { key: `addedDate`, reverse: true }
  )
  const [filters, setFilters] = useState({})
  const [db] = useTorrents()

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
      .setSort=${setSort}
      .sort=${sort}
      .torrents=${torrents}
      .filters=${filters}
    ></x-torrents>
    <div id="drag-ver"></div>
    <div id="footer">footer</div>
  `
})
