import { useEffect, useState, useMemo, html } from "../../component.js"
import * as torrentActions from "../../torrentActions.js"
import useConfig from "../../useConfig.js"

export default function ContextMenu({
  selections,
  removeTorrent,
  setShowDetails,
  torrents,
  setChangeLocation,
  setTransfer,
}) {
  const [position, setPosition] = useState(false)
  const config = useConfig()

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

  function supports(capability) {
    return (
      selectedTorrents.length > 0 &&
      selectedTorrents.every((torrent) =>
        config?.clients.find(
          (client) =>
            client.id === torrent.clientId &&
            client.state === `online` &&
            client.capabilities?.[capability]
        )
      )
    )
  }

  const canTransfer =
    supports(`transfer`) &&
    config?.clients.some(
      (client) =>
        client.state === `online` &&
        client.capabilities?.addTorrent &&
        !selectedTorrents.some((torrent) => torrent.clientId === client.id)
    )

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
    supports,
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
              ?disabled=${!supports(`stopTorrents`)}
              @click=${() => {
                setPosition(false)
                pause()
              }}
            >
              Pause
            </button>
            <button
              ?disabled=${!supports(`startTorrents`)}
              @click=${() => {
                setPosition(false)
                resume()
              }}
            >
              Resume
            </button>
            <div class="divider"></div>
            <button
              ?disabled=${!supports(`verifyTorrents`)}
              @click=${() => {
                setPosition(false)
                verify(selections.getIds())
              }}
            >
              Verify
            </button>
            <button
              ?disabled=${!supports(`setLocation`)}
              @click=${() => {
                setPosition(false)
                setChangeLocation(selections.getIds())
              }}
            >
              Set location
            </button>
            <button
              ?disabled=${!canTransfer}
              @click=${() => {
                setPosition(false)
                setTransfer(selections.getIds())
              }}
            >
              Transfer
            </button>
            <div class="divider"></div>
            <button
              ?disabled=${!supports(`removeTorrents`)}
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
