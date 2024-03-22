import styles from "./styles.js"
import { component, html } from "component"

component(`x-filters`, styles, function Filters({filters, setFilter}) {
  return html`
    <section id="states"></section>
    <section id="clients"></section>
    <section id="trackers"></section>
    <section id="labels"></section>
  `
})
