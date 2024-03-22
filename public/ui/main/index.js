import "../torrents/index.js"
import styles from "./styles.js"
import { component, html, useState, useMemo } from "component"
import useTorrents from "../../useTorrents.js"

let initialSort = null

try {
  initialSort = JSON.parse(localStorage.sort)
} catch (e) {}

component(`x-main`, styles, function Main() {
  const [sort, _setSort] = useState(
    initialSort || { key: `addedDate`, reverse: true }
  )
  const [db] = useTorrents()

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
          return reverse ? -1 : 1
        }
        if (a.name < b.name) {
          return reverse ? 1 : -1
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
    <div id="header">Total: ${db.count()}</div>
    <x-torrents
      .setSort=${setSort}
      .sort=${sort}
      .torrents=${db.values()}
    ></x-torrents>
    <div id="sidebar">sidebar</div>
    <div id="footer">footer</div>
  `
})
