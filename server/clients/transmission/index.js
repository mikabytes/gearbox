import path from "path"
import fs from "fs/promises"

import Requester from "./Requester.js"
import deepEqual from "../../deepEqual.js"
import fields from "./fields.js"
import * as guid from "../../guid.js"
import logger from "../../logger.js"

export default async function Transmission({
  id: clientId,
  host,
  port,
  user,
  password,
  changes: changesCb,
  workdir,
  torrentDir,
}) {
  if (!host || !port || !clientId) {
    throw new Error("host, id and port are required")
  }

  if (!clientId.match(/^[a-z0-9]+$/)) {
    throw new Error(
      `ID must be 1 to 6 characters long and contain only a-z and 0-9`
    )
  }

  // make sure torrents folder exists
  const torrentsFolder = path.join(workdir, `torrents`)
  await fs.mkdir(torrentsFolder).catch((e) => {})

  const gearboxTorrentFiles = new Set()
  for (const file of await fs.readdir(torrentsFolder)) {
    gearboxTorrentFiles.add(file)
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

  async function processTorrent(torrent) {
    const filename = `${clientId}_${torrent.hashString}.torrent`
    const gearboxTorrent = path.join(torrentsFolder, filename)

    if (torrentDir && torrent.hashString) {
      // new torrent, or this torrent changed hashString
      const exists = gearboxTorrentFiles.has(filename)

      if (!exists) {
        const clientTorrent = path.join(
          torrentDir,
          `${torrent.hashString}.torrent`
        )

        try {
          logger.debug(
            `Copying torrent from "${clientTorrent}" to "${gearboxTorrent}"`
          )
          await fs.copyFile(clientTorrent, gearboxTorrent)
          gearboxTorrentFiles.add(filename)
        } catch (e) {
          logger.error(
            `Failed to copy torrent from "${clientTorrent}" to "${gearboxTorrent}"`,
            e
          )
        }
      }
    }
    return {
      ...torrent,
      clientId,
      localId: torrent.id,
      localTorrentFile: torrent.torrentFile,
      torrentFile: gearboxTorrent,
      // make id globally unique
      id: guid.encode({ clientId, torrentId: torrent.id }),
    }
  }

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
      t = await processTorrent(t)
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
        logger.debug(`Reloading all torrents`)
        await reloadAll()
        return
      }

      for (let torrentId of removedIds) {
        const id = guid.encode({ clientId, torrentId })
        processDeletedTorrent(id)
      }

      for (let t of torrents) {
        t = await processTorrent(t)
        processChangedTorrent(t)
      }
    } catch (e) {
      logger.error(e)
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
