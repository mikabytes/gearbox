import { useEffect } from "../../component.js"

export default function filterSideEffects({
  filters,
  selections,
  showTorrentCount,
  setShowTorrentCount,
  totalTorrents,
}) {
  // When filters change, reset selections, scroll up, and show less
  useEffect(() => {
    this.shadowRoot.querySelector(`.container`).scrollTop = 0
    setShowTorrentCount(100)
    selections.reset([])
  }, [filters])

  // when scroll to bottom, show more
  useEffect(() => {
    let div = this.shadowRoot.querySelector(`.container`)
    const onScroll = () => {
      if (div.scrollTop + div.offsetHeight >= div.scrollHeight - 100) {
        if (showTorrentCount < totalTorrents) {
          setShowTorrentCount(Math.min(totalTorrents, showTorrentCount * 2))
        }
      }
    }
    div.addEventListener(`scroll`, onScroll)
    return () => {
      div.removeEventListener(`scroll`, onScroll)
    }
  }, [showTorrentCount])
}
