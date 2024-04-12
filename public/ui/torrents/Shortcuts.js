import { useEffect } from "../../component.js"
import * as torrentActions from "../../torrentActions.js"
import { STOPPED } from "../../enums.js"

export default function useShortcuts({ selections, torrents, removeTorrent }) {
  useEffect(() => {
    const keydown = (e) => {
      if (e.key === `ArrowDown`) {
        e.preventDefault()
        // move selection down
        const selectedIds = selections.getIds()
        const lastSelectedId = selectedIds[selectedIds.length - 1]
        for (let i = 0; i < torrents.length; i++) {
          if (torrents[i].id === lastSelectedId) {
            if (i + 1 < torrents.length) {
              if (e.shiftKey) {
                selections.set([...selections, torrents[i + 1].id])
              } else {
                selections.set([torrents[i + 1].id])
              }
            }
          }
        }
      } else if (e.key === `ArrowUp`) {
        e.preventDefault()
        const selectedIds = selections.getIds()
        const lastSelectedId = selectedIds[selectedIds.length - 1]
        for (let i = 0; i < torrents.length; i++) {
          if (torrents[i].id === lastSelectedId) {
            if (i - 1 >= 0) {
              if (e.shiftKey) {
                selections.set([...selections, torrents[i - 1].id])
              } else {
                selections.set([torrents[i - 1].id])
              }
            }
          }
        }
        return
      } else if (
        e.key === "Delete" ||
        e.key === "Backspace" ||
        e.key === "x" ||
        e.key === "-"
      ) {
        e.preventDefault()
        removeTorrent.remove(selections.getIds())
      } else if (e.key === ` `) {
        const selectedTorrents = torrents.filter((t) =>
          selections.includes(t.id)
        )
        const allPaused = selectedTorrents.every((t) => t.status === STOPPED)

        if (allPaused) {
          torrentActions.resume(selectedTorrents.map((t) => t.id))
        } else {
          torrentActions.pause(
            selectedTorrents
              .filter((t) => t.status !== STOPPED)
              .map((t) => t.id)
          )
        }
      } else if (e.key === `a` && e.ctrlKey) {
        selections.set(torrents.map((t) => t.id))
      }
    }
    this.addEventListener(`keydown`, keydown)
    return () => {
      this.removeEventListener(`keydown`, keydown)
    }
  }, [torrents, selections])
}
