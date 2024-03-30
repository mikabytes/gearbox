import { useEffect, useState, html } from "../../component.js"

export default function ContextMenu({ selections, removeTorrent }) {
  const [position, setPosition] = useState(false)

  useEffect(() => {
    function removeContextMenu() {
      setPosition(false)
      removeTorrent.reset()
    }
    document.addEventListener(`click`, removeContextMenu)

    return () => {
      document.removeEventListener(`click`, removeContextMenu)
    }
  }, [setPosition, removeTorrent])

  useEffect(() => {
    if (position) {
      this.shadowRoot.querySelector(`#context-menu`).focus()
    }
  }, [position])

  const show = (x, y) => {
    setPosition([x, y])
  }

  const hide = (x, y) => {
    setPosition(false)
  }

  return {
    show,
    hide,
    html: !position
      ? html``
      : html`
          <div
            id="context-menu"
            tabindex="-1"
            @click=${(e) => e.stopPropagation()}
            style="left: ${position[0]}px; top: ${position[1]}px;"
          >
            <button
              @mousedown=${() => {
                setPosition(false)
                removeTorrent.remove(selections.getIds())
              }}
            >
              Remove
            </button>
          </div>
        `,
  }
}
