import { useEffect } from "../../component.js"

export default function useKeyPress({ selections, torrents, removeTorrent }) {
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
      }
    }
    this.addEventListener(`keydown`, keydown)
    return () => {
      this.removeEventListener(`keydown`, keydown)
    }
  }, [torrents, selections])
}
