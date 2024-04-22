import compression from "compression"

export default function all({ getAll, count }) {
  // Does something similar to torrent-get Transmission RPC call,
  // but places each torrent on its own line and includes the total
  // torrent count so that we may parse torrents as they are received
  // and animate the startup screen
  return (req, res) => {
    res.setHeader(`Content-Type`, `text/json+lines`)

    const iterator = getAll()
    const firstItem = iterator.next().value

    if (!firstItem) {
      res.write(`{"keys": [], "total": 0}\n`)
      res.end()
      return
    }
    const keys = Object.keys(firstItem)

    function writeLine(item) {
      res.write(JSON.stringify(keys.map((k) => item[k])))
      res.write(`\n`)
    }

    // first line is metadata
    res.write(JSON.stringify({ keys, total: count() }))
    res.write(`\n`)

    // ...then each line is only values, without keys
    // all objects have the same keys, so we save 60% bandwidth
    writeLine(firstItem)

    let ids = new Set()
    for (const t of iterator) {
      if (ids.has(t.id)) {
        console.log(`Tried to send duplicate id '${t.name}'`)
        continue
      }
      ids.add(t.id)
      writeLine(t)
    }

    res.end()
  }
}
