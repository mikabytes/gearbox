import { component, css, html, useEffect } from "../component.js"

component(
  `x-popup`,
  await css(import.meta.resolve(`./popup.css`)),
  function Popup({ title, onDone, disabled }) {
    function keydown(e) {
      if (e.key === "Escape") {
        onDone()
      }
      e.stopPropagation()
    }

    useEffect(() => {
      this.addEventListener(`click`, onDone)

      return () => {
        this.removeEventListener(`click`, onDone)
      }
    }, [])

    return html`
      <section
        @click=${(e) => e.stopPropagation()}
        tabindex="-1"
        @keydown=${keydown}
      >
        <div id="header">
          <h1>${title}</h1>
          <slot name="buttons"></slot>
          <button id="abort" @click=${onDone} ?disabled=${disabled}>✕</button>
        </div>
        <slot></slot>
      </section>
    `
  }
)
