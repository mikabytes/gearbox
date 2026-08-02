import deepEqual from "../../deepEqual.js"
import normalizeTorrent from "./normalizeTorrent.js"

export default function TorrentCache({
  clientId,
  clientType,
  changes,
  globalId,
  now = Date.now,
}) {
  const torrents = new Map()
  const globalByLocal = new Map()
  const recent = new Map()

  function upsert(localId, patch, { notify = true } = {}) {
    const localKey = `${localId}`
    let id = globalByLocal.get(localKey)
    if (id === undefined) {
      id = globalId(localId)
      globalByLocal.set(localKey, id)
    }

    const existing = torrents.get(id)
    const torrent = normalizeTorrent(
      { ...(existing || {}), ...patch },
      {
        id,
        localId,
        clientId,
        clientType,
      }
    )

    torrents.set(id, torrent)

    const changeSet = existing ? difference(existing, torrent) : torrent
    const changed = !existing || Object.keys(changeSet).length > 0
    if (notify && changed) {
      recent.set(id, now())
      changes?.({ id, changeSet })
    }

    return torrent
  }

  function remove(localId, { notify = true } = {}) {
    const localKey = `${localId}`
    const id = globalByLocal.get(localKey)
    if (id === undefined || !torrents.has(id)) return false

    torrents.delete(id)
    globalByLocal.delete(localKey)
    if (notify) {
      recent.set(id, now())
      changes?.({ id, isRemoved: true })
    }
    return true
  }

  function replaceAll(entries, { notify = true } = {}) {
    const seen = new Set()
    for (const [localId, torrent] of entries) {
      seen.add(`${localId}`)
      upsert(localId, torrent, { notify })
    }

    for (const localId of [...globalByLocal.keys()]) {
      if (!seen.has(localId)) remove(localId, { notify })
    }
  }

  function getRecent() {
    const cutoff = now() - 60000
    const ret = []
    for (const [id, changedAt] of recent) {
      if (changedAt < cutoff) {
        recent.delete(id)
      } else if (torrents.has(id)) {
        ret.push(torrents.get(id))
      } else {
        ret.push({ id, isRemoved: true })
      }
    }
    return ret.values()
  }

  return {
    count: () => torrents.size,
    get: (id) => torrents.get(id),
    getAll: () => torrents.values(),
    getByLocalId(localId) {
      const id = globalByLocal.get(`${localId}`)
      return id === undefined ? undefined : torrents.get(id)
    },
    getRecent,
    remove,
    replaceAll,
    upsert,
  }
}

function difference(before, after) {
  const ret = {}
  for (const key of Object.keys(after)) {
    if (!deepEqual(before[key], after[key])) ret[key] = after[key]
  }
  return ret
}
