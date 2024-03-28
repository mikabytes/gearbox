import * as guid from "./guid.js"
import Requester from "./Requester.js"
import deepEqual from "./deepEqual.js"
import fields from "./torrentFields.js"

function processTorrent(clientId, torrent) {
  return {
    ...torrent,
    clientId,
    localId: torrent.id,
    // make id globally unique
    id: guid.encode({ clientId, torrentId: torrent.id }),
  }
}

export default async function Connector({
  id: clientId,
  ip,
  port,
  changes: changesCb,
}) {
  if (!ip || !port || !clientId) {
    throw new Error("ip, id and port are required")
  }

  // we allow only a-z and 0-9 in id
  if (clientId.length > 6 || !clientId.match(/^[a-z0-9]+$/)) {
    throw new Error(
      `ID must be 1 to 6 characters long and contain only a-z and 0-9`
    )
  }

  const request = Requester(`${ip}:${port}`)

  const cache = new Map()
  let lastUpdateAt
  const ret = {
    id: clientId,
    ip,
    port,
    request,
  }

  function old() {
    // more than 50 seconds has passed since last successful update. Transmission only saves changes up to 60 seconds (hardcoded) we have to request all torrents anew
    return Date.now - lastUpdateAt > 50000
  }

  function resetTimer() {
    lastUpdateAt = Date.now()
  }

  async function reloadAll() {
    const {
      arguments: { torrents },
    } = await request(`torrent-get`, {
      fields,
    })
    lastUpdateAt = Date.now()

    cache.clear()

    let fictionalId = 10000

    for (let t of torrents) {
      t = processTorrent(clientId, t)
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
      id: torrent.id,
      changeSet,
    })
  }

  async function streamingUpdates() {
    try {
      const {
        arguments: { torrents, removed: removedIds },
      } = await request(`torrent-get`, {
        fields,
        ids: `recently-active`,
      })

      if (old()) {
        await reloadAll()
        return
      }

      for (let torrentId of removedIds) {
        const id = guid.encode({ clientId, torrentId })
        processDeletedTorrent(id)
      }

      for (let t of torrents) {
        t = processTorrent(clientId, t)
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
    count() {
      return cache.size
    },
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
