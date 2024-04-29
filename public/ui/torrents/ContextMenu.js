import { useEffect, useState, useMemo, html } from "../../component.js"
import * as torrentActions from "../../torrentActions.js"

export default function ContextMenu({
  selections,
  removeTorrent,
  setShowDetails,
  torrents,
  setChangeLocation,
  setTransfer,
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

  function verify() {
    torrentActions.verify(selections.getIds())
  }

  let selectedTorrents = useMemo(() => {
    return torrents.filter((torrent) => selections.includes(torrent.id))
  }, [selections, torrents])

  function pause() {
    const notPaused = selectedTorrents.filter((t) => t.status !== 0)
    torrentActions.pause(notPaused.map((t) => t.id))
  }

  function resume() {
    const paused = selectedTorrents.filter((t) => t.status === 0)
    torrentActions.resume(paused.map((t) => t.id))
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
                pause()
              }}
            >
              Pause
            </button>
            <button
              @click=${() => {
                setPosition(false)
                resume()
              }}
            >
              Resume
            </button>
            <div class="divider"></div>
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
                setChangeLocation(selections.getIds())
              }}
            >
              Set location
            </button>
            <button
              @click=${() => {
                setPosition(false)
                setTransfer(selections.getIds())
              }}
            >
              Transfer
            </button>
            <div class="divider"></div>
            <button
              @click=${() => {
                setPosition(false)
                removeTorrent.remove(selections.getIds())
              }}
            >
              Remove
            </button>
            <div class="divider"></div>
            <button
              @click=${() => {
                setPosition(false)
                setShowDetails(true)
              }}
            >
              Details
            </button>
          </div>
        `,
  }
}
