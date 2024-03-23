import styles from "./styles.js"
import { component, html, useState, useMemo } from "../../component.js"

component(`x-header`, styles, function Header({ total }) {
  return html`<div id="header">Total: ${total}</div>`
})
