import styles from "./styles.js"
import {
  component,
  html,
  useState,
  useMemo,
  useEffect,
} from "../../component.js"
import { filtersToStr, strToFilters } from "../../filterStrLib.js"

component(`x-header`, styles, function Header({ filters, setFilters }) {
  this.generatedSearch = filtersToStr(filters)

  console.log(filters)

  useEffect(() => {
    document.location.hash = this.generatedSearch
  }, [this.generatedSearch])

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
    <div></div>
    <input
      type="search"
      placeholder="Search Torrents"
      .value=${this.search || this.generatedSearch}
      @input=${onInput}
      @blur=${onBlur}
    />
    <div></div>
  `
})
