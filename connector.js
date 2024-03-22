import fields from "./torrentFields.js"
import deepEqual from "./deepEqual.js"
import Requester from "./Requester.js"

function guid({ clientId, torrentId }) {
  const ret = `${clientId}-${torrentId}`
  return ret
}

function processTorrent(clientId, torrent) {
  return {
    ...torrent,
    clientId,
    localId: torrent.id,
    // make id globally unique
    id: guid({ clientId, torrentId: torrent.id }),
  }
}

export default async function Connector({ id, ip, port, changes: changesCb }) {
  if (!ip || !port) {
    throw new Error("ip and port are required")
  }

  const request = Requester(`${ip}:${port}`)

  const cache = new Map()
  let lastUpdateAt
  const ret = {
    id,
    ip,
    port,
  }

  function old() {
    // more than 50 seconds has passed since last successful update. Transmission only saves changes up to 60 seconds (hardcoded) we have to request all torrents anew
    return Date.now - lastUpdateAt > 50000
  }

  function resetTimer() {
    lastUpdateAt = Date.now()
  }

  async function reloadAll() {
    const { torrents } = await request(`torrent-get`, {
      fields,
    })
    lastUpdateAt = Date.now()

    cache.clear()

    for (let t of torrents) {
      t = processTorrent(id, t)
      cache.set(t.id, t)
    }
  }

  function processDeletedTorrent(id) {
    cache.delete(id)
    changesCb?.({
      id,
      isRemoved: true,
    })
  }

  function processChangedTorrent(torrent) {
    const existingTorrent = cache.get(torrent.id)
    const changeSet = {}

    if (!existingTorrent) {
      cache.set(torrent.id, torrent)
      Object.assign(changeSet, torrent)
    } else {
      for (const key of Object.keys(existingTorrent)) {
        const newValue = torrent[key]
        if (!deepEqual(existingTorrent[key], newValue)) {
          changeSet[key] = newValue
          existingTorrent[key] = newValue
        }
      }
    }
    changesCb?.({
      id: existingTorrent.id,
      changeSet,
    })
  }

  async function streamingUpdates() {
    try {
      const { torrents, removed: removedIds } = await request(`torrent-get`, {
        fields,
        ids: `recently-active`,
      })

      if (old()) {
        await reloadAll()
        return
      }

      for (let torrentId of removedIds) {
        id = guid({ clientId: id, torrentId })
        processDeletedTorrent(id)
      }

      for (let t of torrents) {
        t = processTorrent(id, t)
        processChangedTorrent(t)
      }
    } catch (e) {
      console.log(e)
    } finally {
      setTimeout(streamingUpdates, 1000)
    }
  }

  await reloadAll()
  streamingUpdates()

  Object.assign(ret, {
    get(id) {
      return cache.get(id)
    },
    getAll() {
      return cache.values()
    },
    stream(cb) {
      cbs.add(cb)
    },
  })

  return ret
}
