import { useEffect, useState, html } from "../../component.js"

export default function ContextMenu({
  selections,
  removeTorrent,
  setShowDetails,
}) {
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

  async function verify() {
    const res = await fetch(`/transmission/rpc`, {
      method: `POST`,
      headers: {
        "Content-Type": `application/json`,
      },
      body: JSON.stringify({
        method: `torrent-verify`,
        arguments: {
          ids: selections.getIds(),
        },
      }),
    })

    if (!res.ok) {
      console.error(res.status)
      alert(`Unexpected response: ${res.status}`)
      return
    }

    const json = await res.json()
    if (!json.result === `success`) {
      console.error(json.result)
      alert(json.result)
    }
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
              @click=${() => {
                setPosition(false)
                setShowDetails(true)
              }}
            >
              Details
            </button>
            <button
              @click=${() => {
                setPosition(false)
                verify(selections.getIds())
              }}
            >
              Verify
            </button>
            <button
              @click=${() => {
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
