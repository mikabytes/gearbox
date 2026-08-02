import path from "path"

import { capabilities } from "../contract.js"
import TorrentCache from "../shared/TorrentCache.js"
import Requester from "./Requester.js"
import { magnetHashes, metainfoHashes } from "./metainfo.js"
import { mapFiles, mapTorrent, mapTrackers } from "./normalize.js"

const HASH = /^[a-f0-9]{40}$|^[a-f0-9]{64}$/i

export default async function Qbittorrent(config, dependencies = {}) {
  const {
    id: clientId,
    url,
    username = ``,
    password = ``,
    torrentDir,
    pollInterval = 1000,
    fullSyncInterval = 300000,
    enrichmentConcurrency = 4,
  } = config
  const {
    changes,
    fetch,
    globalId,
    logger,
    now = Date.now,
    reportStatus,
    schedule = setTimeout,
    torrentStore,
  } = dependencies

  validateConfig({
    clientId,
    url,
    globalId,
    enrichmentConcurrency,
    pollInterval,
    fullSyncInterval,
  })

  const api = Requester(url, { username, password, fetch, logger })
  const cache = TorrentCache({
    clientId,
    clientType: `qbittorrent`,
    changes,
    now,
    globalId(localId) {
      return globalId(clientId, localId)
    },
  })
  const nativeByHash = new Map()
  const detailsByHash = new Map()
  const enrichmentQueued = new Set()
  const enrichmentInFlight = new Set()
  const enrichmentRetryAt = new Map()
  let enrichmentQueue = []
  let enrichmentCursor = 0
  let enrichmentActive = 0
  let enrichmentDrainScheduled = false
  let initialized = false
  let rid = 0
  let lastFullSyncAt = 0
  let majorVersion

  await api.login()
  const version = `${await api.request(`app/version`, { responseType: `text` })}`.trim()
  majorVersion = validateVersion(version)
  await synchronize(true)
  initialized = true
  schedule(poll, pollInterval)

  async function synchronize(forceFull = false) {
    const response = await api.request(`sync/maindata`, {
      params: { rid: forceFull ? 0 : rid },
    })
    if (!response || !Number.isInteger(response.rid)) {
      throw new Error(`qBittorrent returned an invalid sync response`)
    }

    rid = response.rid
    if (response.full_update || forceFull) {
      const seen = new Set()
      const entries = []
      for (const [hash, patch] of Object.entries(response.torrents || {})) {
        const localId = normalizeHash(hash)
        const native = { ...patch, hash: localId }
        nativeByHash.set(localId, native)
        seen.add(localId)
        entries.push([localId, mapTorrent(native, detailsByHash.get(localId))])
        enqueueEnrichment(localId)
      }

      for (const hash of [...nativeByHash.keys()]) {
        if (!seen.has(hash)) {
          nativeByHash.delete(hash)
          detailsByHash.delete(hash)
          enrichmentRetryAt.delete(hash)
        }
      }
      cache.replaceAll(entries, { notify: initialized })
      lastFullSyncAt = now()
    } else {
      for (const hash of response.torrents_removed || []) removeHash(hash)
      for (const [hash, patch] of Object.entries(response.torrents || {})) {
        upsertNative(hash, patch)
      }
    }

    reportStatus?.(`online`)
  }

  async function poll() {
    try {
      await synchronize(now() - lastFullSyncAt >= fullSyncInterval)
    } catch (error) {
      reportStatus?.(`offline`, error.message)
      logger?.error?.(error)
    } finally {
      schedule(poll, pollInterval)
    }
  }

  function upsertNative(hash, patch, options) {
    hash = normalizeHash(hash)
    const native = { ...(nativeByHash.get(hash) || {}), ...patch, hash }
    nativeByHash.set(hash, native)
    const torrent = cache.upsert(
      hash,
      mapTorrent(native, detailsByHash.get(hash)),
      options
    )
    enqueueEnrichment(hash)
    return torrent
  }

  function removeHash(hash) {
    hash = normalizeHash(hash)
    nativeByHash.delete(hash)
    detailsByHash.delete(hash)
    enrichmentRetryAt.delete(hash)
    cache.remove(hash)
  }

  function enqueueEnrichment(hash) {
    const details = detailsByHash.get(hash) || {}
    const complete =
      Object.hasOwn(details, `files`) &&
      Object.hasOwn(details, `trackers`) &&
      (!torrentDir || details.torrentFile)
    if (
      complete ||
      enrichmentQueued.has(hash) ||
      enrichmentInFlight.has(hash) ||
      now() < (enrichmentRetryAt.get(hash) || 0)
    ) {
      return
    }

    enrichmentQueued.add(hash)
    enrichmentQueue.push(hash)
    scheduleEnrichmentDrain()
  }

  function scheduleEnrichmentDrain() {
    if (enrichmentDrainScheduled) return
    enrichmentDrainScheduled = true
    schedule(() => {
      enrichmentDrainScheduled = false
      drainEnrichment()
    }, 0)
  }

  function drainEnrichment() {
    while (
      enrichmentActive < enrichmentConcurrency &&
      enrichmentCursor < enrichmentQueue.length
    ) {
      const hash = enrichmentQueue[enrichmentCursor++]
      enrichmentQueued.delete(hash)
      enrichmentInFlight.add(hash)
      enrichmentActive++
      enrich(hash)
        .catch((error) => logger?.debug?.(`Could not enrich ${hash}: ${error.message}`))
        .finally(() => {
          enrichmentInFlight.delete(hash)
          enrichmentActive--
          if (enrichmentCursor >= enrichmentQueue.length) {
            enrichmentQueue = []
            enrichmentCursor = 0
          }
          if (enrichmentCursor < enrichmentQueue.length) {
            scheduleEnrichmentDrain()
          }
        })
    }
  }

  async function enrich(hash) {
    if (!nativeByHash.has(hash)) return
    const previous = detailsByHash.get(hash) || {}
    const tasks = []

    if (!Object.hasOwn(previous, `files`)) {
      tasks.push({
        key: `files`,
        promise: api
          .request(`torrents/files`, { params: { hash } })
          .then(mapFiles),
      })
    }
    if (!Object.hasOwn(previous, `trackers`)) {
      tasks.push({
        key: `trackers`,
        promise: api
          .request(`torrents/trackers`, { params: { hash } })
          .then(mapTrackers),
      })
    }
    if (torrentDir && !previous.torrentFile && torrentStore?.capture) {
      tasks.push({
        key: `torrentFile`,
        promise: torrentStore.capture({
          clientId,
          hash,
          sourceDirectory: torrentDir,
        }),
      })
    }

    const results = await Promise.allSettled(tasks.map((task) => task.promise))
    if (!nativeByHash.has(hash)) return
    const details = { ...previous, ...(detailsByHash.get(hash) || {}) }
    let failed = false
    results.forEach((result, index) => {
      if (result.status === `fulfilled`) {
        const key = tasks[index].key
        if (key === `torrentFile`) {
          if (result.value) {
            details.torrentFile = result.value
            details.localTorrentFile = path.join(torrentDir, `${hash}.torrent`)
          } else {
            failed = true
          }
        } else {
          details[key] = result.value
        }
      } else {
        failed = true
      }
    })

    detailsByHash.set(hash, details)
    if (failed) enrichmentRetryAt.set(hash, now() + 60000)
    else enrichmentRetryAt.delete(hash)
    cache.upsert(hash, mapTorrent(nativeByHash.get(hash), details))
  }

  async function post(method, body) {
    await api.request(`torrents/${method}`, {
      method: `POST`,
      body,
      responseType: `none`,
    })
    return {}
  }

  function joinedHashes(ids) {
    if (!Array.isArray(ids) || !ids.length) {
      throw new Error(`At least one torrent id is required`)
    }
    return ids.map(normalizeHash).join(`|`)
  }

  async function action(method, ids, extra = {}) {
    return post(method, { hashes: joinedHashes(ids), ...extra })
  }

  async function fetchTorrentInfo(hashes) {
    const torrents = await api.request(`torrents/info`, {
      params: { hashes: hashes.join(`|`) },
    })
    for (const torrent of torrents || []) {
      if (torrent.hash) upsertNative(torrent.hash, torrent)
    }
    return torrents || []
  }

  async function addTorrent(args = {}) {
    let normalized = normalizeAddArguments(args)
    if (/^https?:/i.test(normalized.filename || ``)) {
      normalized = await fetchMetainfo(normalized, fetch)
    }
    const candidates = normalized.metainfo
      ? metainfoHashes(normalized.metainfo)
      : magnetHashes(normalized.filename)
    const duplicate = candidates.map((hash) => cache.getByLocalId(hash)).find(Boolean)
    const deferredStart =
      !duplicate && normalized.paused !== true && hasFilePriorityArguments(normalized)
    const form = new FormData()

    if (normalized.metainfo) {
      const data = Buffer.from(normalized.metainfo, `base64`)
      form.append(
        `torrents`,
        new Blob([data], { type: `application/x-bittorrent` }),
        `${candidates[0]}.torrent`
      )
    } else {
      form.append(`urls`, normalized.filename)
    }
    appendAddOptions(
      form,
      deferredStart ? { ...normalized, paused: true } : normalized,
      majorVersion
    )

    await api.request(`torrents/add`, {
      method: `POST`,
      body: form,
      responseType: `none`,
    })

    const found = await fetchTorrentInfo(candidates)
    const actualHash = normalizeHash(found[0]?.hash || duplicate?.localId || candidates[0])
    const torrent = cache.getByLocalId(actualHash)
    if (!torrent) {
      throw new Error(
        `qBittorrent accepted the add request but the torrent could not be confirmed`
      )
    }

    if (normalized.metainfo && torrentStore?.save) {
      try {
        const torrentFile = await torrentStore.save({
          clientId,
          hash: actualHash,
          metainfo: normalized.metainfo,
        })
        const details = { ...(detailsByHash.get(actualHash) || {}), torrentFile }
        detailsByHash.set(actualHash, details)
        cache.upsert(actualHash, mapTorrent(nativeByHash.get(actualHash), details))
      } catch (error) {
        throw partialAddError(actualHash, `saving metainfo`, error)
      }
    }

    if (!duplicate) {
      try {
        await applyFilePriorities(actualHash, normalized)
        if (hasShareArguments(normalized)) {
          await applyShareLimits(actualHash, normalized)
        }
        if (deferredStart) {
          await action(majorVersion >= 5 ? `start` : `resume`, [actualHash])
        }
      } catch (error) {
        throw partialAddError(actualHash, `applying torrent options`, error)
      }
    }

    const resultTorrent = cache.getByLocalId(actualHash)
    const key = duplicate ? `torrent-duplicate` : `torrent-added`
    return {
      [key]: {
        id: resultTorrent.id,
        name: resultTorrent.name,
        hashString: resultTorrent.hashString,
      },
    }
  }

  async function setTorrents(ids, args = {}) {
    const values = normalizeSetArguments(args)
    const hashes = ids.map(normalizeHash)
    const joined = hashes.join(`|`)

    // Validate native-dependent share modes before making any mutations.
    if (hasShareArguments(values)) {
      for (const hash of hashes) shareLimitArguments(nativeByHash.get(hash) || {}, values)
    }

    if (values.downloadLimit !== undefined || values.downloadLimited !== undefined) {
      const limit = speedLimit(values, `download`)
      await post(`setDownloadLimit`, { hashes: joined, limit })
    }
    if (values.uploadLimit !== undefined || values.uploadLimited !== undefined) {
      const limit = speedLimit(values, `upload`)
      await post(`setUploadLimit`, { hashes: joined, limit })
    }
    if (values.labels !== undefined) {
      for (const hash of hashes) {
        await post(`removeTags`, { hashes: hash, tags: `` })
        const category = nativeByHash.get(hash)?.category
        const tags = values.labels.filter((label) => label !== category).join(`,`)
        if (tags) await post(`addTags`, { hashes: hash, tags })
      }
    }
    if (values.group !== undefined) {
      await post(`setCategory`, { hashes: joined, category: values.group })
    }

    for (const hash of hashes) {
      await applyFilePriorities(hash, values)
      if (hasShareArguments(values)) await applyShareLimits(hash, values)
      await applyTrackers(hash, values)
    }

    if (values.sequentialDownload !== undefined) {
      const changed = hashes.filter(
        (hash) =>
          !!nativeByHash.get(hash)?.seq_dl !== values.sequentialDownload
      )
      if (changed.length) {
        await post(`toggleSequentialDownload`, { hashes: changed.join(`|`) })
      }
    }
    return {}
  }

  async function applyFilePriorities(hash, values) {
    const wanted = values.filesWanted
    const unwanted = values.filesUnwanted
    const high = values.priorityHigh
    const normal = values.priorityNormal
    if (
      wanted === undefined &&
      unwanted === undefined &&
      high === undefined &&
      normal === undefined
    ) {
      return
    }

    const priorities = new Map()
    if (wanted !== undefined) {
      const files = await api.request(`torrents/files`, { params: { hash } })
      const wantedSet = new Set(validateIndexes(wanted, `filesWanted`))
      const available = new Set()
      for (const [position, file] of files.entries()) {
        const index = Number.isInteger(file.index) ? file.index : position
        available.add(index)
        priorities.set(index, wantedSet.has(index) ? 1 : 0)
      }
      const missing = [...wantedSet].filter((index) => !available.has(index))
      if (missing.length) {
        throw new Error(`filesWanted contains unknown file index ${missing[0]}`)
      }
    }
    for (const index of validateIndexes(unwanted, `filesUnwanted`)) {
      priorities.set(index, 0)
    }
    for (const index of validateIndexes(normal, `priorityNormal`)) {
      priorities.set(index, 1)
    }
    for (const index of validateIndexes(high, `priorityHigh`)) {
      priorities.set(index, 6)
    }

    for (const priority of [0, 1, 6]) {
      const indexes = [...priorities]
        .filter(([, value]) => value === priority)
        .map(([index]) => index)
      if (indexes.length) {
        await post(`filePrio`, {
          hash,
          id: indexes.join(`|`),
          priority,
        })
      }
    }
  }

  async function applyShareLimits(hash, values) {
    const native = nativeByHash.get(hash) || {}
    const { ratioLimit, inactiveSeedingTimeLimit } = shareLimitArguments(
      native,
      values
    )
    await post(`setShareLimits`, {
      hashes: hash,
      ratioLimit,
      seedingTimeLimit: nativeLimitMinutes(native.seeding_time_limit),
      inactiveSeedingTimeLimit,
    })
  }

  async function applyTrackers(hash, values) {
    if (values.trackerList !== undefined) {
      const existing = await trackerDetails(hash)
      const urls = existing.trackers.map((tracker) => tracker.announce)
      if (urls.length) {
        await post(`removeTrackers`, { hash, urls: urls.join(`|`) })
      }
      const replacement = values.trackerList
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean)
      if (replacement.length) {
        await post(`addTrackers`, { hash, urls: replacement.join(`\n`) })
      }
      return
    }

    let existing
    if (values.trackerAdd?.length) {
      await post(`addTrackers`, { hash, urls: values.trackerAdd.join(`\n`) })
    }
    if (values.trackerRemove?.length) {
      existing ||= await trackerDetails(hash)
      const removed = new Set(values.trackerRemove)
      const urls = existing.trackers
        .filter((tracker) => removed.has(tracker.id))
        .map((tracker) => tracker.announce)
      if (urls.length !== removed.size) {
        const known = new Set(existing.trackers.map((tracker) => tracker.id))
        const missing = [...removed].find((id) => !known.has(id))
        throw new Error(`Unknown qBittorrent tracker id ${missing}`)
      }
      await post(`removeTrackers`, {
        hash,
        urls: urls.join(`|`),
      })
    }
    if (values.trackerReplace?.length) {
      existing ||= await trackerDetails(hash)
      for (let index = 0; index < values.trackerReplace.length; index += 2) {
        const id = values.trackerReplace[index]
        const newUrl = values.trackerReplace[index + 1]
        const original = existing.trackers.find((tracker) => tracker.id === id)
        if (!original) throw new Error(`Unknown qBittorrent tracker id ${id}`)
        await post(`editTracker`, {
          hash,
          origUrl: original.announce,
          newUrl,
        })
      }
    }
  }

  async function trackerDetails(hash) {
    let details = detailsByHash.get(hash)?.trackers
    if (!details) {
      details = mapTrackers(
        await api.request(`torrents/trackers`, { params: { hash } })
      )
      detailsByHash.set(hash, {
        ...(detailsByHash.get(hash) || {}),
        trackers: details,
      })
    }
    return details
  }

  async function renameTorrentPath(ids, args = {}) {
    assertArguments(args, new Set([`ids`, `path`, `name`]), `torrent-rename-path`)
    if (!args.path || !args.name) {
      throw new Error(`torrent-rename-path requires path and name`)
    }
    const hashes = ids.map(normalizeHash)
    for (const hash of hashes) {
      const torrent = cache.getByLocalId(hash)
      if (args.path === torrent?.name) {
        await post(`rename`, { hash, name: args.name })
        continue
      }

      let files = torrent?.files || []
      if (!files.length) {
        const mapped = mapFiles(
          await api.request(`torrents/files`, { params: { hash } })
        )
        files = mapped.files
      }
      const isFolder = files.some((file) => file.name.startsWith(`${args.path}/`))
      const newPath = path.posix.join(path.posix.dirname(args.path), args.name)
      await post(isFolder ? `renameFolder` : `renameFile`, {
        hash,
        oldPath: args.path,
        newPath,
      })
    }
    return { path: args.path, name: args.name }
  }

  return {
    id: clientId,
    type: `qbittorrent`,
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
      transfer: !!torrentDir && !!torrentStore,
    }),
    count: cache.count,
    get: cache.get,
    getAll: cache.getAll,
    getRecent: cache.getRecent,
    addTorrent,
    removeTorrents(ids, args = {}) {
      assertArguments(
        args,
        new Set([`ids`, `delete-local-data`]),
        `torrent-remove`
      )
      return action(`delete`, ids, {
        deleteFiles: args[`delete-local-data`] === true,
      })
    },
    setTorrents,
    setLocation(ids, args = {}) {
      assertArguments(
        args,
        new Set([`ids`, `location`, `move`]),
        `torrent-set-location`
      )
      if (!args.location) throw new Error(`set-location requires location`)
      if (args.move === false) {
        throw new Error(`qBittorrent cannot set a location without moving data`)
      }
      return action(`setLocation`, ids, { location: args.location })
    },
    async startTorrents(ids, args = {}) {
      assertArguments(args, new Set([`ids`]), `torrent-start`)
      await action(`setForceStart`, ids, { value: false })
      return action(majorVersion >= 5 ? `start` : `resume`, ids)
    },
    startTorrentsNow(ids, args = {}) {
      assertArguments(args, new Set([`ids`]), `torrent-start-now`)
      return action(`setForceStart`, ids, { value: true })
    },
    stopTorrents(ids, args = {}) {
      assertArguments(args, new Set([`ids`]), `torrent-stop`)
      return action(majorVersion >= 5 ? `stop` : `pause`, ids)
    },
    verifyTorrents(ids, args = {}) {
      assertArguments(args, new Set([`ids`]), `torrent-verify`)
      return action(`recheck`, ids)
    },
    reannounceTorrents(ids, args = {}) {
      assertArguments(args, new Set([`ids`]), `torrent-reannounce`)
      return action(`reannounce`, ids)
    },
    renameTorrentPath,
    moveQueue(ids, args = {}) {
      assertArguments(args, new Set([`ids`, `direction`]), `queue-move`)
      const method = {
        top: `topPrio`,
        up: `increasePrio`,
        down: `decreasePrio`,
        bottom: `bottomPrio`,
      }[args.direction]
      if (!method) throw new Error(`Invalid queue direction ${args.direction}`)
      return action(method, ids)
    },
    async sessionGet(args = {}) {
      assertArguments(args, new Set([`fields`]), `session-get`)
      if (args.fields !== undefined && !Array.isArray(args.fields)) {
        throw new Error(`session-get fields must be an array`)
      }
      if (args.fields && !args.fields.includes(`download-dir`)) return {}
      const downloadDir = await api.request(`app/defaultSavePath`, {
        responseType: `text`,
      })
      return { "download-dir": downloadDir }
    },
  }
}

function validateConfig({
  clientId,
  url,
  globalId,
  enrichmentConcurrency,
  pollInterval,
  fullSyncInterval,
}) {
  if (!clientId || !url) throw new Error(`url and id are required`)
  if (!/^[a-z0-9]+$/.test(clientId)) {
    throw new Error(`ID must contain only a-z and 0-9`)
  }
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`qBittorrent url is invalid`)
  }
  if (![`http:`, `https:`].includes(parsed.protocol)) {
    throw new Error(`qBittorrent url must use HTTP or HTTPS`)
  }
  if (typeof globalId !== `function`) {
    throw new Error(`qBittorrent connector requires globalId`)
  }
  if (!Number.isInteger(enrichmentConcurrency) || enrichmentConcurrency < 1) {
    throw new Error(`enrichmentConcurrency must be a positive integer`)
  }
  if (!Number.isFinite(pollInterval) || pollInterval < 250) {
    throw new Error(`qBittorrent pollInterval must be at least 250 milliseconds`)
  }
  if (!Number.isFinite(fullSyncInterval) || fullSyncInterval < pollInterval) {
    throw new Error(`qBittorrent fullSyncInterval must be at least pollInterval`)
  }
}

function validateVersion(version) {
  const match = version.match(/^v?(\d+)(?:\.(\d+))?/)
  if (!match) throw new Error(`Unsupported qBittorrent version "${version}"`)
  const major = Number(match[1])
  const minor = Number(match[2] || 0)
  if (major < 4 || (major === 4 && minor < 5)) {
    throw new Error(
      `qBittorrent ${version} is unsupported; Gearbox requires 5.x or 4.5/4.6`
    )
  }
  return major
}

function normalizeHash(hash) {
  hash = `${hash}`.toLowerCase()
  if (!HASH.test(hash)) throw new Error(`Invalid qBittorrent torrent hash "${hash}"`)
  return hash
}

function normalizeAddArguments(args) {
  const ret = aliasArguments(args)
  const allowed = new Set([
    `metainfo`,
    `filename`,
    `downloadDir`,
    `paused`,
    `filesWanted`,
    `filesUnwanted`,
    `priorityHigh`,
    `priorityNormal`,
    `priorityLow`,
    `labels`,
    `group`,
    `name`,
    `downloadLimit`,
    `downloadLimited`,
    `uploadLimit`,
    `uploadLimited`,
    `seedRatioLimit`,
    `seedRatioMode`,
    `seedIdleLimit`,
    `seedIdleMode`,
    `sequentialDownload`,
    `firstLastPiecePrio`,
    `bandwidthPriority`,
    `peerLimit`,
    `cookies`,
    `trashOriginalTorrentFiles`,
  ])
  rejectUnknown(ret, allowed, `torrent-add`)
  if (!!ret.metainfo === !!ret.filename) {
    throw new Error(`torrent-add requires exactly one of metainfo or filename`)
  }
  if (
    ret.filename &&
    !/^magnet:|^https?:/i.test(`${ret.filename}`)
  ) {
    throw new Error(`qBittorrent filename must be a magnet or HTTP(S) URL`)
  }
  rejectUnsupportedDefaults(ret, `torrent-add`)
  validateCollections(ret)
  validateMutationValues(ret)
  return ret
}

function appendAddOptions(form, values, majorVersion) {
  const options = {
    savepath: values.downloadDir,
    [majorVersion >= 5 ? `stopped` : `paused`]: values.paused,
    category: values.group,
    tags: values.labels?.join(`,`),
    rename: values.name,
    dlLimit:
      values.downloadLimited === false
        ? 0
        : values.downloadLimit === undefined
          ? undefined
          : values.downloadLimit * 1000,
    upLimit:
      values.uploadLimited === false
        ? 0
        : values.uploadLimit === undefined
          ? undefined
          : values.uploadLimit * 1000,
    ratioLimit:
      values.seedRatioMode === undefined && values.seedRatioLimit === undefined
        ? undefined
        : transmissionLimit(
            values.seedRatioMode,
            values.seedRatioLimit,
            -2,
            `seedRatioLimit`
          ),
    sequentialDownload: values.sequentialDownload,
    firstLastPiecePrio: values.firstLastPiecePrio,
  }
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) form.append(key, `${value}`)
  }
}

function hasFilePriorityArguments(values) {
  return [
    `filesWanted`,
    `filesUnwanted`,
    `priorityHigh`,
    `priorityNormal`,
  ].some((key) => values[key] !== undefined)
}

function normalizeSetArguments(args) {
  const ret = aliasArguments(args)
  delete ret.ids
  const allowed = new Set([
    `downloadLimit`,
    `downloadLimited`,
    `uploadLimit`,
    `uploadLimited`,
    `seedRatioLimit`,
    `seedRatioMode`,
    `seedIdleLimit`,
    `seedIdleMode`,
    `filesWanted`,
    `filesUnwanted`,
    `priorityHigh`,
    `priorityNormal`,
    `priorityLow`,
    `labels`,
    `group`,
    `trackerAdd`,
    `trackerRemove`,
    `trackerReplace`,
    `trackerList`,
    `sequentialDownload`,
    `honorsSessionLimits`,
  ])
  rejectUnknown(ret, allowed, `torrent-set`)
  rejectUnsupportedDefaults(ret, `torrent-set`)
  validateCollections(ret)
  validateMutationValues(ret)
  if (ret.honorsSessionLimits !== undefined && ret.honorsSessionLimits !== true) {
    throw new Error(`qBittorrent does not support honorsSessionLimits=false`)
  }
  if (ret.trackerReplace && ret.trackerReplace.length % 2) {
    throw new Error(`trackerReplace must contain id/url pairs`)
  }
  return ret
}

function aliasArguments(args) {
  const aliases = {
    "download-dir": `downloadDir`,
    "download-limit": `downloadLimit`,
    "download-limited": `downloadLimited`,
    "upload-limit": `uploadLimit`,
    "upload-limited": `uploadLimited`,
    "files-wanted": `filesWanted`,
    "files-unwanted": `filesUnwanted`,
    "priority-high": `priorityHigh`,
    "priority-normal": `priorityNormal`,
    "priority-low": `priorityLow`,
    "peer-limit": `peerLimit`,
    "trash-original-torrent-files": `trashOriginalTorrentFiles`,
    trackerAdd: `trackerAdd`,
    trackerRemove: `trackerRemove`,
    trackerReplace: `trackerReplace`,
  }
  const ret = {}
  for (const [key, value] of Object.entries(args)) {
    ret[aliases[key] || key] = value
  }
  return ret
}

function rejectUnknown(values, allowed, operation) {
  const unknown = Object.keys(values).filter((key) => !allowed.has(key))
  if (unknown.length) {
    throw new Error(
      `qBittorrent does not support ${operation} argument(s): ${unknown.join(`, `)}`
    )
  }
}

function rejectUnsupportedDefaults(values, operation) {
  if (values.priorityLow?.length) {
    throw new Error(`qBittorrent cannot represent low file priority in ${operation}`)
  }
  if (values.bandwidthPriority !== undefined && values.bandwidthPriority !== 0) {
    throw new Error(`qBittorrent does not support bandwidthPriority`)
  }
  if (values.peerLimit !== undefined && values.peerLimit !== 0) {
    throw new Error(`qBittorrent Web API cannot set a per-torrent peer limit`)
  }
  if (values.cookies !== undefined && typeof values.cookies !== `string`) {
    throw new Error(`cookies must be a string`)
  }
  if (values.trashOriginalTorrentFiles === true) {
    throw new Error(`qBittorrent does not support trash-original-torrent-files`)
  }
}

function validateCollections(values) {
  for (const key of [
    `filesWanted`,
    `filesUnwanted`,
    `priorityHigh`,
    `priorityNormal`,
    `priorityLow`,
    `labels`,
    `trackerAdd`,
    `trackerRemove`,
    `trackerReplace`,
  ]) {
    if (values[key] !== undefined && !Array.isArray(values[key])) {
      throw new Error(`${key} must be an array`)
    }
  }

  for (const key of [
    `filesWanted`,
    `filesUnwanted`,
    `priorityHigh`,
    `priorityNormal`,
    `priorityLow`,
  ]) {
    validateIndexes(values[key], key)
  }
}

function validateMutationValues(values) {
  if (
    values.downloadLimit !== undefined ||
    values.downloadLimited !== undefined
  ) {
    speedLimit(values, `download`)
  }
  if (values.uploadLimit !== undefined || values.uploadLimited !== undefined) {
    speedLimit(values, `upload`)
  }
  if (values.labels?.some((label) => typeof label !== `string`)) {
    throw new Error(`labels must contain only strings`)
  }
  for (const key of [`trackerAdd`, `trackerRemove`]) {
    if (key === `trackerAdd` && values[key]?.some((url) => typeof url !== `string`)) {
      throw new Error(`trackerAdd must contain only strings`)
    }
    if (
      key === `trackerRemove` &&
      values[key]?.some((id) => !Number.isInteger(id) || id < 0)
    ) {
      throw new Error(`trackerRemove must contain only tracker ids`)
    }
  }
  if (values.trackerList !== undefined && typeof values.trackerList !== `string`) {
    throw new Error(`trackerList must be a string`)
  }
  if (values.trackerReplace) {
    for (let index = 0; index < values.trackerReplace.length; index += 2) {
      if (
        !Number.isInteger(values.trackerReplace[index]) ||
        values.trackerReplace[index] < 0 ||
        typeof values.trackerReplace[index + 1] !== `string`
      ) {
        throw new Error(`trackerReplace must contain id/url pairs`)
      }
    }
  }
  if (
    values.sequentialDownload !== undefined &&
    typeof values.sequentialDownload !== `boolean`
  ) {
    throw new Error(`sequentialDownload must be a boolean`)
  }
  for (const key of [`seedRatioMode`, `seedIdleMode`]) {
    if (values[key] !== undefined && ![0, 1, 2].includes(values[key])) {
      throw new Error(`${key} must be 0, 1, or 2`)
    }
  }
  if (values.seedRatioMode === 1) {
    transmissionLimit(1, values.seedRatioLimit, -2, `seedRatioLimit`)
  }
  if (values.seedIdleMode === 1) {
    transmissionLimit(1, values.seedIdleLimit, -2, `seedIdleLimit`)
  }
}

function validateIndexes(indexes, name) {
  if (indexes === undefined) return []
  if (!Array.isArray(indexes)) throw new Error(`${name} must be an array`)
  for (const index of indexes) {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`${name} contains invalid file index ${index}`)
    }
  }
  return indexes
}

function speedLimit(values, prefix) {
  const enabled = values[`${prefix}Limited`]
  const limit = values[`${prefix}Limit`]
  if (enabled === false) return 0
  if (limit === undefined) {
    throw new Error(`${prefix}Limited=true requires ${prefix}Limit`)
  }
  if (!Number.isFinite(limit) || limit < 0) {
    throw new Error(`${prefix}Limit must be a non-negative number`)
  }
  return limit * 1000
}

function hasShareArguments(values) {
  return [
    `seedRatioMode`,
    `seedRatioLimit`,
    `seedIdleMode`,
    `seedIdleLimit`,
  ].some((key) => values[key] !== undefined)
}

function shareLimitArguments(native, values) {
  return {
    ratioLimit: transmissionLimit(
      values.seedRatioMode,
      values.seedRatioLimit,
      native.ratio_limit ?? native.max_ratio,
      `seedRatioLimit`
    ),
    inactiveSeedingTimeLimit: transmissionLimit(
      values.seedIdleMode,
      values.seedIdleLimit,
      nativeLimitMinutes(native.inactive_seeding_time_limit),
      `seedIdleLimit`
    ),
  }
}

function transmissionLimit(mode, limit, current, name) {
  if (mode === undefined) {
    if (limit === undefined) return current ?? -2
    if (current === -2 || current === -1 || current === undefined) {
      throw new Error(`${name} requires its corresponding mode to be set`)
    }
    mode = 1
  }
  if (mode === 0) return -2
  if (mode === 2) return -1
  if (mode !== 1) throw new Error(`Invalid Transmission limit mode ${mode}`)
  if (!Number.isFinite(limit) || limit < 0) {
    throw new Error(`${name} must be a non-negative number in individual mode`)
  }
  return limit
}

function nativeLimitMinutes(value) {
  if (!Number.isFinite(value) || value === -2) return -2
  if (value < 0) return -1
  return Math.round(value / 60)
}

function partialAddError(hash, phase, error) {
  return new Error(
    `qBittorrent added torrent ${hash}, but ${phase} failed: ${error.message}. The torrent was left in place.`
  )
}

async function fetchMetainfo(values, fetchImpl) {
  const headers = {}
  if (values.cookies) headers.Cookie = values.cookies
  const response = await fetchImpl(values.filename, { headers })
  if (!response.ok) {
    throw new Error(
      `Could not download torrent metainfo (${response.status}): ${response.statusText || values.filename}`
    )
  }

  const contentLength = Number(response.headers.get(`content-length`))
  if (Number.isFinite(contentLength) && contentLength > 10_000_000) {
    throw new Error(`Torrent metainfo URL exceeds the 10 MB limit`)
  }
  const data = Buffer.from(await response.arrayBuffer())
  if (data.length > 10_000_000) {
    throw new Error(`Torrent metainfo URL exceeds the 10 MB limit`)
  }

  return {
    ...values,
    filename: undefined,
    cookies: undefined,
    metainfo: data.toString(`base64`),
  }
}

function assertArguments(args, allowed, operation) {
  const unknown = Object.keys(args).filter((key) => !allowed.has(key))
  if (unknown.length) {
    throw new Error(
      `qBittorrent does not support ${operation} argument(s): ${unknown.join(`, `)}`
    )
  }
}
