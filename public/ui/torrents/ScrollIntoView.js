import { useEffect } from "../../component.js"

export default function scrollIntoView({ selections }) {
  useEffect(() => {
    const selectedIds = selections.getIds()
    const lastSelectedId = selectedIds[selectedIds.length - 1]

    const lastSelectedRow = this.shadowRoot.querySelector(
      `.row[data-id="${lastSelectedId}"]`
    )

    lastSelectedRow?.scrollIntoView({ block: `start` })
  }, [selections])
}
