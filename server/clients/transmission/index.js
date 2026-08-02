import Requester from "./Requester.js"
import fields from "./fields.js"
import * as guid from "../../guid.js"
import TorrentCache from "../shared/TorrentCache.js"
import { capabilities } from "../contract.js"

export default async function Transmission(config, dependencies) {
  const {
    id: clientId,
    host,
    port,
    url,
    user,
    password,
    torrentDir,
  } = config
  const {
    changes,
    fetch,
    logger,
    reportStatus,
    torrentStore,
    now = Date.now,
    schedule = setTimeout,
  } = dependencies

  if ((!url && (!host || !port)) || !clientId) {
    throw new Error(`url (or host and port) and id are required`)
  }

  if (!clientId.match(/^[a-z0-9]+$/)) {
    throw new Error(`ID must contain only a-z and 0-9`)
  }

  const baseUrl = url || `http://${host}:${port}`
  const request = Requester(baseUrl, { user, password, fetch, logger })
  const cache = TorrentCache({
    clientId,
    clientType: `transmission`,
    changes,
    now,
    globalId(localId) {
      return guid.encode({ clientId, torrentId: Number(localId) })
    },
  })

  let initialized = false
  let lastUpdateAt = 0

  async function prepare(torrent) {
    const existing = cache.getByLocalId(torrent.id)
    let torrentFile = existing?.torrentFile || ``
    if (
      torrent.hashString &&
      (!existing || existing.hashString !== torrent.hashString)
    ) {
      torrentFile = await torrentStore.capture({
        clientId,
        hash: torrent.hashString,
        sourceDirectory: torrentDir,
        sourceFilename: torrent.torrentFile,
      })
    }

    return {
      ...torrent,
      localTorrentFile: torrent.torrentFile,
      torrentFile,
    }
  }

  async function reloadAll() {
    const response = await request(`torrent-get`, { fields }, false)
    const entries = []
    for (const torrent of response.arguments.torrents) {
      entries.push([torrent.id, await prepare(torrent)])
    }
    cache.replaceAll(entries, { notify: initialized })
    lastUpdateAt = now()
    reportStatus?.(`online`)
  }

  async function poll() {
    try {
      const response = await request(
        `torrent-get`,
        { fields, ids: `recently-active` },
        false
      )

      if (now() - lastUpdateAt > 50000) {
        await reloadAll()
      } else {
        for (const localId of response.arguments.removed || []) {
          cache.remove(localId)
        }
        for (const torrent of response.arguments.torrents || []) {
          cache.upsert(torrent.id, await prepare(torrent))
        }
        lastUpdateAt = now()
        reportStatus?.(`online`)
      }
    } catch (error) {
      reportStatus?.(`offline`, error.message)
      logger.error(error)
    } finally {
      schedule(poll, 1000)
    }
  }

  async function mutate(method, ids, args = {}) {
    const { ids: ignoredIds, direction, ...rest } = args
    const response = await request(method, { ...rest, ids })
    return response.arguments || {}
  }

  await reloadAll()
  initialized = true
  schedule(poll, 1000)

  return {
    id: clientId,
    type: `transmission`,
    capabilities: capabilities({
      addTorrent: true,
      removeTorrents: true,
      setTorrents: true,
      setLocation: true,
      startTorrents: true,
      startTorrentsNow: true,
      stopTorrents: true,
      verifyTorrents: true,
      reannounceTorrents: true,
      renameTorrentPath: true,
      moveQueue: true,
      sessionGet: true,
      transfer: !!torrentDir,
    }),
    count: cache.count,
    get: cache.get,
    getAll: cache.getAll,
    getRecent: cache.getRecent,
    async addTorrent(args) {
      const response = await request(`torrent-add`, args)
      const result = response.arguments || {}
      const added = result[`torrent-added`] || result[`torrent-duplicate`]
      if (added?.hashString && args.metainfo) {
        await torrentStore.save({
          clientId,
          hash: added.hashString,
          metainfo: args.metainfo,
        })
      }
      return result
    },
    removeTorrents: (ids, args) => mutate(`torrent-remove`, ids, args),
    setTorrents: (ids, args) => mutate(`torrent-set`, ids, args),
    setLocation: (ids, args) => mutate(`torrent-set-location`, ids, args),
    startTorrents: (ids, args) => mutate(`torrent-start`, ids, args),
    startTorrentsNow: (ids, args) => mutate(`torrent-start-now`, ids, args),
    stopTorrents: (ids, args) => mutate(`torrent-stop`, ids, args),
    verifyTorrents: (ids, args) => mutate(`torrent-verify`, ids, args),
    reannounceTorrents: (ids, args) =>
      mutate(`torrent-reannounce`, ids, args),
    renameTorrentPath: (ids, args) =>
      mutate(`torrent-rename-path`, ids, args),
    moveQueue(ids, args) {
      return mutate(`queue-move-${args.direction}`, ids, args)
    },
    async sessionGet(args) {
      const response = await request(`session-get`, args)
      return response.arguments || {}
    },
  }
}
