import Requester from "./Requester.js"
import deepEqual from "../../deepEqual.js"
import fields from "./fields.js"
import * as guid from "../../guid.js"

function processTorrent(clientId, torrent) {
  return {
    ...torrent,
    clientId,
    localId: torrent.id,
    // make id globally unique
    id: guid.encode({ clientId, torrentId: torrent.id }),
  }
}

export default async function Transmission({
  id: clientId,
  host,
  port,
  user,
  password,
  changes: changesCb,
}) {
  if (!host || !port || !clientId) {
    throw new Error("host, id and port are required")
  }

  // we allow only a-z and 0-9 in id
  if (clientId.length > 6 || !clientId.match(/^[a-z0-9]+$/)) {
    throw new Error(
      `ID must be 1 to 6 characters long and contain only a-z and 0-9`
    )
  }

  const request = Requester(`${host}:${port}`, { user, password })

  const cache = new Map()
  let lastUpdateAt
  const ret = {
    id: clientId,
    host,
    port,
    request,
  }

  // recently changed objects, key is guid, value is date
  const recent = new Map()

  function updateRecent(id) {
    recent.set(id, Date.now())
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
    } = await request(`torrent-get`, { fields }, false)
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
    updateRecent(id)
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
    updateRecent(torrent.id)
    changesCb?.({
      id: torrent.id,
      changeSet,
    })
  }

  async function streamingUpdates() {
    try {
      const {
        arguments: { torrents, removed: removedIds },
      } = await request(
        `torrent-get`,
        {
          fields,
          ids: `recently-active`,
        },
        false
      )

      if (old()) {
        console.log(`Reloading all torrents`)
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
    *getRecent() {
      const now = Date.now()
      for (const id of recent.keys()) {
        // delete items that are older than 60 seconds
        const date = recent.get(id)
        if (now - date > 60000) {
          recent.delete(id)
          continue
        }

        if (cache.has(id)) {
          yield cache.get(id)
        } else {
          yield { id, isRemoved: true }
        }
      }
    },
  })

  return ret
}
