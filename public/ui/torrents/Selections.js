import { useMemo, useState } from "../../component.js"

export default function selectionManager({
  torrents,
  selections,
  setSelections,
}) {
  function onClickRow(e, _id) {
    const id = _id || +this.dataset.id

    if (!e.shiftKey && !e.ctrlKey) {
      if (selections.length === 1 && selections[0] === id) {
        setSelections([])
      } else {
        setSelections([id])
      }
      return
    }

    if (e.ctrlKey) {
      if (selections.includes(id)) {
        setSelections(selections.filter((k) => k !== id))
      } else {
        setSelections([...selections, id])
      }
      return
    }

    if (e.shiftKey) {
      let startIndex = torrents.findIndex((t) => t.id === id)
      let stopIndex = torrents.findIndex(
        (t) => t.id === selections[selections.length - 1]
      )

      if (startIndex > stopIndex) {
        ;[startIndex, stopIndex] = [stopIndex, startIndex]
      }

      setSelections([
        ...new Set(
          selections.concat(
            torrents.slice(startIndex, stopIndex + 1).map((t) => t.id)
          )
        ),
      ])
    }
  }

  function set(ids) {
    setSelections(ids)
  }

  function reset() {
    setSelections([])
  }

  function getIds() {
    return selections
  }

  function includes(id) {
    return selections.includes(id)
  }

  return { onClickRow, getIds, reset, set, includes }
}
