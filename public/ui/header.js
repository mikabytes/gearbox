import { component, html, css } from "../../component.js"
import { filtersToStr, strToFilters } from "../../filterStrLib.js"
import fileToTorrent from "../fileToTorrent.js"
import filterIcon from "../icons/filter.js"

component(
  `x-header`,
  await css(import.meta.resolve(`./header.css`)),
  function Header({ filters, setFilters, setTorrentsToAdd, toggleSidebar }) {
    this.generatedSearch = filtersToStr(filters)

    // we have to make a little workaround so that filters won't interrupt us writing
    const onInput = (e) => {
      const val = e.target.value
      this.search = val
      setFilters(strToFilters(val))
    }

    const onBlur = () => {
      delete this.search
      this.shadowRoot.querySelector(`input`).value = this.generatedSearch
    }

    const pickFile = () => {
      this.shadowRoot.getElementById("fileInput").click()
    }

    const filesPicked = (e) => {
      const files = [...e.target.files]
      console.log(files)
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
    }

    return html`
      <button id="toggleFilters" @click=${toggleSidebar}>${filterIcon}</button>
      <input
        type="search"
        placeholder="Search Torrents"
        .value=${this.search || this.generatedSearch}
        @input=${onInput}
        @blur=${onBlur}
      />
      <div></div>
      <input
        type="file"
        id="fileInput"
        accept=".torrent"
        multiple
        @change=${filesPicked}
      />
      <button id="upload" @click=${pickFile}>➕</button>
    `
  }
)
