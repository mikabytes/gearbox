import {
  component,
  html,
  useState,
  useMemo,
  useEffect,
  css,
} from "../../component.js"
import { filtersToStr, strToFilters } from "../../filterStrLib.js"

component(
  `x-header`,
  await css(import.meta.resolve(`./header.css`)),
  function Header({ filters, setFilters }) {
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

    return html`
      <input
        type="search"
        placeholder="Search Torrents"
        .value=${this.search || this.generatedSearch}
        @input=${onInput}
        @blur=${onBlur}
      />
      <div></div>
    `
  }
)