import { capabilities } from "../contract.js"
import TorrentCache from "../shared/TorrentCache.js"
import deepEqual from "../../deepEqual.js"
import Requester from "./Requester.js"
import { magnetHashes, metainfoHashes } from "./metainfo.js"
import { applyFileSelection, mapTorrent, STATUS_KEYS } from "./mapping.js"

const DEFAULT_POLL_INTERVAL = 1000
const DEFAULT_RECONCILE_INTERVAL = 50000
const CAPTURE_RETRY_INTERVAL = 60000
const EXPENSIVE_STATUS_KEYS = new Set([
  `file_priorities`,
  `file_progress`,
  `files`,
  `peers`,
  `trackers`,
])
const POLL_STATUS_KEYS = STATUS_KEYS.filter(
  (field) => !EXPENSIVE_STATUS_KEYS.has(field)
)

const FILE_ARGUMENTS = [
  `filesWanted`,
  `filesUnwanted`,
  `priority-low`,
  `priority-normal`,
  `priority-high`,
]

export default async function Deluge(config, dependencies) {
  const {
    id: clientId,
    url,
    password,
    daemonId,
    torrentDir,
    pollInterval = DEFAULT_POLL_INTERVAL,
    reconcileInterval = DEFAULT_RECONCILE_INTERVAL,
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
    password,
    globalId,
    pollInterval,
    reconcileInterval,
  })

  const cache = TorrentCache({
    clientId,
    clientType: `deluge`,
    changes,
    now,
    globalId(localId) {
      return globalId(clientId, localId)
    },
  })

  let initialized = false
  let lastFullAt = 0
  let selectedDaemonId
  let remoteMethods = new Set()
  const nativeStatus = new Map()
  const captureQueue = []
  const capturePending = new Set()
  const captureRetryAt = new Map()
  const labelCreations = new Map()
  let activeCaptures = 0

  const rpc = Requester(url, {
    password,
    fetch,
    async onRenew() {
      if (!selectedDaemonId) return
      let connected = await rpc.raw(`web.connected`, [])
      if (!connected) {
        const methods = await rpc.raw(`web.connect`, [selectedDaemonId])
        if (Array.isArray(methods)) remoteMethods = new Set(methods)
        connected = await rpc.raw(`web.connected`, [])
      }
      if (!connected) {
        throw new Error(
          `Deluge Web session renewed but daemon "${selectedDaemonId}" is disconnected`
        )
      }
    },
  })

  async function selectDaemon() {
    const hosts = await rpc.request(`web.get_hosts`, [])
    if (!Array.isArray(hosts) || !hosts.length) {
      throw new Error(`Deluge Web has no configured daemon hosts`)
    }

    const configured = daemonId
      ? hosts.find((host) => host?.[0] === daemonId)
      : undefined
    if (daemonId && !configured) {
      throw new Error(`Deluge daemonId "${daemonId}" is not in the Web host list`)
    }

    let connectedHost
    const webWasConnected = await rpc.request(`web.connected`, [])
    if (webWasConnected) {
      for (const host of hosts) {
        try {
          const status = await rpc.request(`web.get_host_status`, [host[0]])
          if (`${status?.[1] || ``}`.toLowerCase() === `connected`) {
            connectedHost = host
            break
          }
        } catch (error) {
          logger?.debug?.(
            `Could not inspect Deluge daemon "${host[0]}": ${error.message}`
          )
        }
      }
    }

    let selected = configured || (!daemonId && connectedHost)
    if (!selected && !daemonId) {
      const webConfig = await rpc.request(`web.get_config`, [])
      const defaultId = webConfig?.default_daemon
      if (defaultId) selected = hosts.find((host) => host?.[0] === defaultId)
    }
    if (!selected && hosts.length === 1) selected = hosts[0]

    if (!selected) {
      throw new Error(
        `Deluge Web has multiple daemon hosts; configure daemonId explicitly`
      )
    }

    selectedDaemonId = selected[0]
    if (!connectedHost || connectedHost[0] !== selectedDaemonId) {
      // A deluge-web process owns a single daemon connection. Switching an
      // explicitly selected/default host must close the previous one first.
      if (webWasConnected) await rpc.request(`web.disconnect`, [])
      const methods = await rpc.request(`web.connect`, [selectedDaemonId])
      if (Array.isArray(methods)) remoteMethods = new Set(methods)
    }

    if (!(await rpc.request(`web.connected`, []))) {
      throw new Error(
        `Deluge Web could not connect to daemon "${selectedDaemonId}"`
      )
    }

    const hostStatus = await rpc.request(`web.get_host_status`, [
      selectedDaemonId,
    ])
    validateVersion(hostStatus?.[2])

    const methods = await rpc.request(`system.listMethods`, [])
    if (Array.isArray(methods)) remoteMethods = new Set(methods)
  }

  async function reconnectDaemon() {
    let connected = await rpc.request(`web.connected`, [])
    if (connected) await rpc.request(`web.disconnect`, [])
    const methods = await rpc.request(`web.connect`, [selectedDaemonId])
    if (Array.isArray(methods)) remoteMethods = new Set(methods)
    connected = await rpc.request(`web.connected`, [])
    if (!connected) {
      throw new Error(`Deluge daemon "${selectedDaemonId}" is disconnected`)
    }
  }

  async function daemonRequest(method, params = []) {
    try {
      return await rpc.request(method, params)
    } catch (error) {
      // When deluged disconnects, its exported core methods disappear from the
      // Web JSON method list and are reported as unknown. Reconnect once.
      if (error?.code !== 2 || !/^core\.|^label\./.test(method)) throw error
      await reconnectDaemon()
      return rpc.request(method, params)
    }
  }

  function prepare(localId, source) {
    const localKey = `${localId}`.toLowerCase()
    const existing = cache.getByLocalId(localKey)
    return {
      ...mapTorrent(localKey, source, { now }),
      torrentFile: existing?.torrentFile || ``,
    }
  }

  async function reloadAll() {
    const torrents = await daemonRequest(`core.get_torrents_status`, [
      {},
      STATUS_KEYS,
      false,
    ])
    if (!torrents || typeof torrents !== `object`) {
      throw new Error(`Deluge daemon "${selectedDaemonId}" returned no torrent data`)
    }

    nativeStatus.clear()
    const entries = Object.entries(torrents).map(([localId, source]) => {
      localId = localId.toLowerCase()
      nativeStatus.set(localId, source)
      return [localId, prepare(localId, source)]
    })

    if (!initialized) {
      cache.replaceAll(entries, { notify: false })
    } else {
      const seen = new Set()
      for (const [localId, torrent] of entries) {
        seen.add(localId)
        const existing = cache.getByLocalId(localId)
        if (!existing || patchChanged(existing, torrent)) {
          cache.upsert(localId, torrent)
        }
      }
      for (const torrent of [...cache.getAll()]) {
        if (!seen.has(`${torrent.localId}`)) {
          cache.remove(torrent.localId)
          captureRetryAt.delete(torrent.localId)
        }
      }
    }
    for (const [localId, torrent] of entries) {
      if (!torrent.torrentFile) queueCapture(localId)
    }
    lastFullAt = now()
    reportStatus?.(`online`)
  }

  async function updateRecent() {
    if (now() - lastFullAt >= reconcileInterval) return reloadAll()

    const patches = await daemonRequest(`core.get_torrents_status`, [
      {},
      POLL_STATUS_KEYS,
      false,
    ])
    if (!patches || typeof patches !== `object`) {
      throw new Error(`Deluge daemon "${selectedDaemonId}" returned invalid update data`)
    }

    // Deluge's diff cache belongs to the daemon RPC session shared by
    // deluge-web, so another Web UI consumer can advance it. Poll the compact
    // summary keys as a complete snapshot and reserve expensive arrays for the
    // periodic reconciliation snapshot.
    const seen = new Set(
      Object.keys(patches).map((localId) => `${localId}`.toLowerCase())
    )
    for (const localId of seen) {
      let patch = patches[localId] || patches[localId.toUpperCase()]
      if (!patch) continue

      const source = { ...(nativeStatus.get(localId) || {}), ...patch }
      nativeStatus.set(localId, source)
      const torrent = prepare(localId, source)
      const existing = cache.getByLocalId(localId)
      if (!existing || patchChanged(existing, torrent)) {
        const updated = cache.upsert(localId, torrent)
        if (!updated.torrentFile) queueCapture(localId)
      }
    }

    for (const localId of [...nativeStatus.keys()]) {
      if (!seen.has(localId)) {
        nativeStatus.delete(localId)
        cache.remove(localId)
        captureRetryAt.delete(localId)
      }
    }
    reportStatus?.(`online`)
  }

  async function poll() {
    try {
      await updateRecent()
    } catch (error) {
      reportStatus?.(`offline`, error.message)
      logger?.error?.(error)
    } finally {
      schedule(poll, pollInterval)
    }
  }

  function queueCapture(localId) {
    if (
      !torrentDir ||
      !torrentStore?.capture ||
      capturePending.has(localId) ||
      (captureRetryAt.get(localId) || 0) > now()
    ) {
      return
    }
    capturePending.add(localId)
    captureQueue.push(localId)
    drainCaptures()
  }

  function drainCaptures() {
    while (activeCaptures < 2 && captureQueue.length) {
      const localId = captureQueue.shift()
      activeCaptures++
      Promise.resolve(
        torrentStore.capture({
          clientId,
          hash: localId,
          sourceDirectory: torrentDir,
        })
      )
        .then((torrentFile) => {
          const torrent = cache.getByLocalId(localId)
          if (!torrent) {
            captureRetryAt.delete(localId)
          } else if (torrent.hashString === localId && torrentFile) {
            captureRetryAt.delete(localId)
            cache.upsert(localId, { torrentFile }, { notify: initialized })
          } else if (!torrentFile) {
            captureRetryAt.set(localId, now() + CAPTURE_RETRY_INTERVAL)
          }
        })
        .catch((error) => {
          logger?.error?.(
            `Failed to capture Deluge metainfo for ${localId}: ${error.message}`
          )
          captureRetryAt.set(localId, now() + CAPTURE_RETRY_INTERVAL)
        })
        .finally(() => {
          activeCaptures--
          capturePending.delete(localId)
          drainCaptures()
        })
    }
  }

  async function statusFor(localId, keys = STATUS_KEYS) {
    const status = await daemonRequest(`core.get_torrent_status`, [localId, keys])
    if (!status || typeof status !== `object`) {
      throw new Error(`Deluge returned no status for torrent ${localId}`)
    }
    return status
  }

  async function refreshOne(localId, torrentFile = ``) {
    const status = await statusFor(localId)
    nativeStatus.set(localId, status)
    const prepared = prepare(localId, status)
    if (torrentFile) prepared.torrentFile = torrentFile
    const torrent = cache.upsert(localId, prepared)
    if (!torrent.torrentFile) queueCapture(localId)
    return torrent
  }

  await rpc.login()
  await selectDaemon()
  await reloadAll()
  initialized = true
  schedule(poll, pollInterval)

  return {
    id: clientId,
    type: `deluge`,
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

    async addTorrent(input = {}) {
      const args = aliasArguments(input)
      assertArguments(
        args,
        new Set([
          `metainfo`,
          `filename`,
          `download-dir`,
          `paused`,
          `peer-limit`,
          `bandwidthPriority`,
          `downloadLimit`,
          `downloadLimited`,
          `uploadLimit`,
          `uploadLimited`,
          `sequentialDownload`,
          `seedRatioLimit`,
          `seedRatioMode`,
          `labels`,
          `group`,
          `name`,
          `cookies`,
          `trashOriginalTorrentFiles`,
          ...FILE_ARGUMENTS,
        ]),
        `torrent-add`
      )

      if (!!args.metainfo === !!args.filename) {
        throw new Error(`Deluge torrent-add requires exactly one of metainfo or filename`)
      }
      if (args.bandwidthPriority && args.bandwidthPriority !== 0) {
        throw unsupported(`torrent-add`, `bandwidthPriority`)
      }
      rejectUnsupportedDefaults(args, `torrent-add`)
      const labels = delugeLabels(args, remoteMethods)
      validateMutationArguments(args)

      const fileSelection = hasFileArguments(args)
      const resumeAfterSelection = fileSelection && args.paused !== true
      const options = addOptions(args)
      if (fileSelection) options.add_paused = true
      const candidates = args.metainfo
        ? metainfoHashes(args.metainfo)
        : /^magnet:/i.test(args.filename)
          ? magnetHashes(args.filename)
          : []
      const existing = candidates
        .map((hash) => cache.getByLocalId(hash))
        .find(Boolean)
      let duplicate = !!existing
      let localId = existing?.localId

      if (!duplicate) {
        try {
          if (args.metainfo) {
            localId = await daemonRequest(`core.add_torrent_file`, [
              `gearbox.torrent`,
              args.metainfo,
              options,
            ])
          } else if (/^magnet:/i.test(args.filename)) {
            localId = await daemonRequest(`core.add_torrent_magnet`, [
              args.filename,
              options,
            ])
          } else if (/^https?:/i.test(args.filename)) {
            localId = await daemonRequest(`core.add_torrent_url`, [
              args.filename,
              options,
              args.cookies ? { Cookie: args.cookies } : {},
            ])
          } else {
            throw new Error(
              `Deluge torrent-add filename must be a magnet or HTTP(S) URL`
            )
          }
        } catch (error) {
          localId = duplicateHash(error)
          if (!localId) throw error
          duplicate = true
          if (!cache.getByLocalId(localId)) await refreshOne(localId)
        }
      }

      if (!localId) {
        localId = candidates.find((hash) => cache.getByLocalId(hash))
        duplicate = !!localId
        if (!duplicate) {
          throw new Error(
            `Deluge did not return a torrent id; it may already exist`
          )
        }
      }
      localId = `${localId}`.toLowerCase()

      let torrent = cache.getByLocalId(localId)
      if (!duplicate) {
        try {
          let addedTorrentFile = ``
          if (args.metainfo && torrentStore?.save) {
            addedTorrentFile = await torrentStore.save({
              clientId,
              hash: localId,
              metainfo: args.metainfo,
            })
          }

          if (fileSelection) {
            const status = await statusFor(localId, [`file_priorities`])
            const current = Array.isArray(status.file_priorities)
              ? status.file_priorities
              : []
            const filePriorities = applyFileSelection(current, args, localId)
            await daemonRequest(`core.set_torrent_options`, [
              [localId],
              { file_priorities: filePriorities },
            ])
          }

          if (labels !== undefined) await setLabels([localId], labels)
          if (resumeAfterSelection) {
            await daemonRequest(`core.resume_torrents`, [[localId]])
          }
          torrent = await refreshOne(localId, addedTorrentFile)
        } catch (error) {
          throw partialAddError(localId, error)
        }
      }
      const result = {
        id: torrent?.id,
        name: torrent?.name || localId,
        hashString: localId,
      }
      return { [duplicate ? `torrent-duplicate` : `torrent-added`]: result }
    },

    async removeTorrents(ids, args = {}) {
      assertArguments(
        args,
        new Set([`ids`, `delete-local-data`]),
        `torrent-remove`
      )
      const errors = await daemonRequest(`core.remove_torrents`, [
        ids,
        args[`delete-local-data`] === true,
      ])
      if (Array.isArray(errors) && errors.length) {
        throw new Error(
          `Deluge failed to remove: ${errors
            .map(([id, message]) => `${id}: ${message}`)
            .join(`; `)}`
        )
      }
      return {}
    },

    async setTorrents(ids, input = {}) {
      const args = aliasArguments(input)
      assertArguments(
        args,
        new Set([
          `ids`,
          `downloadLimit`,
          `downloadLimited`,
          `uploadLimit`,
          `uploadLimited`,
          `peer-limit`,
          `seedRatioLimit`,
          `seedRatioMode`,
          `sequentialDownload`,
          `bandwidthPriority`,
          `labels`,
          `group`,
          `honorsSessionLimits`,
          `trackerAdd`,
          `trackerRemove`,
          `trackerReplace`,
          `trackerList`,
          ...FILE_ARGUMENTS,
        ]),
        `torrent-set`
      )

      if (args.bandwidthPriority && args.bandwidthPriority !== 0) {
        throw unsupported(`torrent-set`, `bandwidthPriority`)
      }
      rejectUnsupportedDefaults(args, `torrent-set`)
      const labels = delugeLabels(args, remoteMethods)
      validateMutationArguments(args)
      if (args.downloadLimited === true && args.downloadLimit === undefined) {
        throw new Error(`Deluge requires downloadLimit when enabling downloadLimited`)
      }
      if (args.uploadLimited === true && args.uploadLimit === undefined) {
        throw new Error(`Deluge requires uploadLimit when enabling uploadLimited`)
      }

      const options = torrentOptions(args)
      if (Object.keys(options).length) {
        await daemonRequest(`core.set_torrent_options`, [ids, options])
      }

      if (hasFileArguments(args)) {
        for (const localId of ids) {
          const status = await statusFor(localId, [`file_priorities`])
          const priorities = applyFileSelection(
            status.file_priorities || [],
            args,
            localId
          )
          await daemonRequest(`core.set_torrent_options`, [
            [localId],
            { file_priorities: priorities },
          ])
        }
      }

      if (labels !== undefined) await setLabels(ids, labels)
      if (
        args.trackerAdd !== undefined ||
        args.trackerRemove !== undefined ||
        args.trackerReplace !== undefined ||
        args.trackerList !== undefined
      ) {
        await setTrackers(ids, args)
      }
      return {}
    },

    async setLocation(ids, args = {}) {
      assertArguments(args, new Set([`ids`, `location`, `move`]), `torrent-set-location`)
      if (!args.location || typeof args.location !== `string`) {
        throw new Error(`Deluge torrent-set-location requires location`)
      }
      if (args.move === false) {
        throw new Error(
          `Deluge cannot change a download location without moving its data`
        )
      }
      await daemonRequest(`core.move_storage`, [ids, args.location])
      return {}
    },

    async startTorrents(ids, args = {}) {
      assertArguments(args, new Set([`ids`]), `torrent-start`)
      await daemonRequest(`core.resume_torrents`, [ids])
      return {}
    },

    async startTorrentsNow(ids, args = {}) {
      assertArguments(args, new Set([`ids`]), `torrent-start-now`)
      await daemonRequest(`core.queue_top`, [ids])
      await daemonRequest(`core.resume_torrents`, [ids])
      return {}
    },

    async stopTorrents(ids, args = {}) {
      assertArguments(args, new Set([`ids`]), `torrent-stop`)
      await daemonRequest(`core.pause_torrents`, [ids])
      return {}
    },

    async verifyTorrents(ids, args = {}) {
      assertArguments(args, new Set([`ids`]), `torrent-verify`)
      await daemonRequest(`core.force_recheck`, [ids])
      return {}
    },

    async reannounceTorrents(ids, args = {}) {
      assertArguments(args, new Set([`ids`]), `torrent-reannounce`)
      await daemonRequest(`core.force_reannounce`, [ids])
      return {}
    },

    async renameTorrentPath(ids, args = {}) {
      assertArguments(args, new Set([`ids`, `path`, `name`]), `torrent-rename-path`)
      if (!args.path || !args.name) {
        throw new Error(`Deluge torrent-rename-path requires path and name`)
      }

      for (const localId of ids) {
        const torrent = cache.getByLocalId(localId)
        const file = torrent?.files?.find((entry) => entry.name === args.path)
        if (file) {
          await daemonRequest(`core.rename_files`, [
            localId,
            [[file.index, replaceBasename(args.path, args.name)]],
          ])
        } else if (
          torrent?.files?.some((entry) => entry.name.startsWith(`${args.path}/`))
        ) {
          await daemonRequest(`core.rename_folder`, [
            localId,
            args.path,
            replaceBasename(args.path, args.name),
          ])
        } else {
          throw new Error(
            `Deluge torrent ${localId} has no file or folder "${args.path}"`
          )
        }
      }
      return {}
    },

    async moveQueue(ids, args = {}) {
      assertArguments(args, new Set([`ids`, `direction`]), `queue-move`)
      if (![`top`, `up`, `down`, `bottom`].includes(args.direction)) {
        throw new Error(`Invalid Deluge queue direction "${args.direction}"`)
      }
      await daemonRequest(`core.queue_${args.direction}`, [ids])
      return {}
    },

    async sessionGet(args = {}) {
      assertArguments(args, new Set([`fields`]), `session-get`)
      if (args.fields !== undefined && !Array.isArray(args.fields)) {
        throw new Error(`session-get fields must be an array`)
      }
      const fields = args.fields || [`download-dir`]
      const configKeys = new Set()
      for (const field of fields) {
        const mapping = SESSION_FIELDS[field]
        if (mapping) configKeys.add(mapping.key)
      }
      if (!configKeys.size) return {}

      const values = await daemonRequest(`core.get_config_values`, [
        [...configKeys],
      ])
      const result = {}
      for (const field of fields) {
        const mapping = SESSION_FIELDS[field]
        if (mapping) result[field] = mapping.map(values?.[mapping.key], values)
      }
      return result
    },
  }

  async function setLabels(ids, labels) {
    if (!Array.isArray(labels)) throw new Error(`labels must be an array`)
    if (labels.length > 1) {
      throw new Error(`Deluge Label supports at most one label per torrent`)
    }
    if (!remoteMethods.has(`label.set_torrent`)) {
      throw new Error(`Deluge Label plugin is not enabled`)
    }
    const label = labels[0] ? await ensureLabel(labels[0]) : ``
    for (const id of ids) {
      await daemonRequest(`label.set_torrent`, [id, label])
    }
  }

  async function ensureLabel(label) {
    let creation = labelCreations.get(label)
    if (!creation) {
      creation = (async () => {
        const existing = await getLabels()
        if (existing.has(label)) return

        try {
          await daemonRequest(`label.add`, [label])
        } catch (error) {
          // Another Deluge/Gearbox client may have created the label after our
          // lookup. Only suppress the error when Deluge now confirms it exists.
          if (!(await getLabels()).has(label)) throw error
        }
      })().finally(() => labelCreations.delete(label))
      labelCreations.set(label, creation)
    }
    await creation
    return label
  }

  async function getLabels() {
    const labels = await daemonRequest(`label.get_labels`)
    if (!Array.isArray(labels)) {
      throw new Error(`Deluge Label plugin returned an invalid label list`)
    }
    return new Set(labels.map((label) => `${label}`.toLowerCase()))
  }

  async function setTrackers(ids, args) {
    for (const id of ids) {
      const status = await statusFor(id, [`trackers`])
      let trackers = Array.isArray(status.trackers)
        ? status.trackers.map((tracker) => ({
            url: `${tracker.url || tracker.announce || ``}`,
            tier: Number(tracker.tier) || 0,
          }))
        : []

      if (args.trackerList !== undefined) {
        if (typeof args.trackerList !== `string`) {
          throw new Error(`trackerList must be a string`)
        }
        trackers = args.trackerList
          .split(/\r?\n/)
          .map((url) => url.trim())
          .filter(Boolean)
          .map((url, tier) => ({ url, tier }))
      }
      if (args.trackerRemove !== undefined) {
        if (!Array.isArray(args.trackerRemove)) {
          throw new Error(`trackerRemove must be an array`)
        }
        const removed = new Set(args.trackerRemove)
        trackers = trackers.filter((_, index) => !removed.has(index))
      }
      if (args.trackerReplace !== undefined) {
        if (!Array.isArray(args.trackerReplace) || args.trackerReplace.length % 2) {
          throw new Error(`trackerReplace must contain id/url pairs`)
        }
        for (let index = 0; index < args.trackerReplace.length; index += 2) {
          const trackerId = args.trackerReplace[index]
          if (!trackers[trackerId]) {
            throw new Error(`Invalid tracker id ${trackerId} for Deluge torrent ${id}`)
          }
          trackers[trackerId].url = `${args.trackerReplace[index + 1]}`
        }
      }
      if (args.trackerAdd !== undefined) {
        if (!Array.isArray(args.trackerAdd)) {
          throw new Error(`trackerAdd must be an array`)
        }
        let tier = trackers.reduce(
          (maximum, tracker) => Math.max(maximum, tracker.tier),
          -1
        )
        for (const url of args.trackerAdd) trackers.push({ url: `${url}`, tier: ++tier })
      }

      trackers.forEach((tracker, index) => {
        tracker.tier = index
      })
      await daemonRequest(`core.set_torrent_trackers`, [id, trackers])
    }
  }
}

function validateConfig({
  clientId,
  url,
  password,
  globalId,
  pollInterval,
  reconcileInterval,
}) {
  if (!clientId || !url) throw new Error(`Deluge url and id are required`)
  if (!/^[a-z0-9]+$/.test(clientId)) {
    throw new Error(`ID must contain only a-z and 0-9`)
  }
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Deluge url is invalid`)
  }
  if (![`http:`, `https:`].includes(parsed.protocol)) {
    throw new Error(`Deluge url must use HTTP or HTTPS`)
  }
  if (typeof password !== `string`) {
    throw new Error(`Deluge Web password is required`)
  }
  if (typeof globalId !== `function`) {
    throw new Error(`Deluge connector requires the globalId dependency`)
  }
  if (!Number.isFinite(pollInterval) || pollInterval < 250) {
    throw new Error(`Deluge pollInterval must be at least 250 milliseconds`)
  }
  if (
    !Number.isFinite(reconcileInterval) ||
    reconcileInterval < pollInterval
  ) {
    throw new Error(`Deluge reconcileInterval must be at least pollInterval`)
  }
}

function addOptions(args) {
  const options = torrentOptions(args)
  if (args[`download-dir`] !== undefined) {
    if (!args[`download-dir`] || typeof args[`download-dir`] !== `string`) {
      throw new Error(`download-dir must be a non-empty string`)
    }
    options.download_location = args[`download-dir`]
  }
  if (args.paused !== undefined) options.add_paused = args.paused === true
  if (args.name !== undefined) {
    if (typeof args.name !== `string`) throw new Error(`name must be a string`)
    options.name = args.name
  }
  return options
}

function torrentOptions(args) {
  const options = {}
  if (args.downloadLimit !== undefined) {
    options.max_download_speed = nonNegative(args.downloadLimit, `downloadLimit`)
  }
  if (args.downloadLimited === false) options.max_download_speed = -1
  if (args.uploadLimit !== undefined) {
    options.max_upload_speed = nonNegative(args.uploadLimit, `uploadLimit`)
  }
  if (args.uploadLimited === false) options.max_upload_speed = -1
  if (args[`peer-limit`] !== undefined) {
    const limit = nonNegative(args[`peer-limit`], `peer-limit`)
    options.max_connections = limit < 2 ? -1 : limit
  }
  if (args.sequentialDownload !== undefined) {
    options.sequential_download = args.sequentialDownload === true
  }
  if (args.seedRatioLimit !== undefined) {
    options.stop_ratio = nonNegative(args.seedRatioLimit, `seedRatioLimit`)
  }
  if (args.seedRatioMode !== undefined) {
    if (args.seedRatioMode === 1) options.stop_at_ratio = true
    else if (args.seedRatioMode === 2) options.stop_at_ratio = false
    else {
      throw new Error(
        `Deluge does not support Transmission's global seedRatioMode (0)`
      )
    }
  }
  return options
}

function hasFileArguments(args) {
  return FILE_ARGUMENTS.some((field) => args[field] !== undefined)
}

function aliasArguments(args) {
  const aliases = {
    "download-limit": `downloadLimit`,
    "download-limited": `downloadLimited`,
    "files-wanted": `filesWanted`,
    "files-unwanted": `filesUnwanted`,
    peerLimit: `peer-limit`,
    priorityHigh: `priority-high`,
    priorityLow: `priority-low`,
    priorityNormal: `priority-normal`,
    "trash-original-torrent-files": `trashOriginalTorrentFiles`,
    "upload-limit": `uploadLimit`,
    "upload-limited": `uploadLimited`,
  }
  return Object.fromEntries(
    Object.entries(args || {}).map(([key, value]) => [aliases[key] || key, value])
  )
}

function rejectUnsupportedDefaults(args, operation) {
  if (args.cookies !== undefined && typeof args.cookies !== `string`) {
    throw new Error(`cookies must be a string`)
  }
  if (args.trashOriginalTorrentFiles === true) {
    throw unsupported(operation, `trash-original-torrent-files`)
  }
  if (args.honorsSessionLimits !== undefined && args.honorsSessionLimits !== true) {
    throw unsupported(operation, `honorsSessionLimits=false`)
  }
}

function validateMutationArguments(args) {
  for (const field of FILE_ARGUMENTS) {
    if (args[field] === undefined) continue
    if (!Array.isArray(args[field])) throw new Error(`${field} must be an array`)
    for (const index of args[field]) {
      if (!Number.isInteger(index) || index < 0) {
        throw new Error(`${field} contains invalid file index ${index}`)
      }
    }
  }
  for (const field of [
    `paused`,
    `downloadLimited`,
    `uploadLimited`,
    `sequentialDownload`,
  ]) {
    if (args[field] !== undefined && typeof args[field] !== `boolean`) {
      throw new Error(`${field} must be a boolean`)
    }
  }
  for (const field of [`trackerAdd`, `trackerRemove`]) {
    if (args[field] !== undefined && !Array.isArray(args[field])) {
      throw new Error(`${field} must be an array`)
    }
  }
  if (args.trackerAdd?.some((url) => typeof url !== `string`)) {
    throw new Error(`trackerAdd must contain only strings`)
  }
  if (
    args.trackerRemove?.some(
      (id) => !Number.isInteger(id) || id < 0
    )
  ) {
    throw new Error(`trackerRemove must contain only non-negative tracker ids`)
  }
  if (
    args.trackerReplace !== undefined &&
    (!Array.isArray(args.trackerReplace) || args.trackerReplace.length % 2)
  ) {
    throw new Error(`trackerReplace must contain id/url pairs`)
  }
  for (let index = 0; index < (args.trackerReplace?.length || 0); index += 2) {
    if (!Number.isInteger(args.trackerReplace[index])) {
      throw new Error(`trackerReplace must contain numeric tracker ids`)
    }
    if (typeof args.trackerReplace[index + 1] !== `string`) {
      throw new Error(`trackerReplace must contain string tracker URLs`)
    }
  }
  if (args.trackerList !== undefined && typeof args.trackerList !== `string`) {
    throw new Error(`trackerList must be a string`)
  }
}

function delugeLabels(args, remoteMethods) {
  if (args.labels === undefined && args.group === undefined) return undefined
  if (args.labels !== undefined && !Array.isArray(args.labels)) {
    throw new Error(`labels must be an array`)
  }
  const values = [...(args.labels || [])]
  if (args.group !== undefined) {
    if (typeof args.group !== `string`) throw new Error(`group must be a string`)
    if (args.group) values.push(args.group)
  }
  if (values.some((label) => typeof label !== `string`)) {
    throw new Error(`labels must contain only strings`)
  }
  const labels = [
    ...new Set(values.filter(Boolean).map((label) => label.toLowerCase())),
  ]
  if (labels.length > 1) {
    throw new Error(`Deluge Label supports at most one label per torrent`)
  }
  if (!remoteMethods.has(`label.set_torrent`)) {
    throw new Error(`Deluge Label plugin is not enabled`)
  }
  if (
    labels.length &&
    (!remoteMethods.has(`label.get_labels`) || !remoteMethods.has(`label.add`))
  ) {
    throw new Error(`Deluge Label plugin does not support creating labels`)
  }
  return labels
}

function duplicateHash(error) {
  if (!/already (?:in session|exists)|duplicate/i.test(error?.message || ``)) {
    return ``
  }
  return (
    `${error.message}`.match(/[a-f0-9]{64}|[a-f0-9]{40}/i)?.[0]?.toLowerCase() ||
    ``
  )
}

function replaceBasename(path, name) {
  const slash = path.lastIndexOf(`/`)
  return slash === -1 ? name : `${path.slice(0, slash + 1)}${name}`
}

function assertArguments(args, allowed, operation) {
  for (const key of Object.keys(args || {})) {
    if (!allowed.has(key)) throw unsupported(operation, key)
  }
}

function unsupported(operation, field) {
  return new Error(`Deluge does not support ${operation} argument "${field}"`)
}

function partialAddError(localId, cause) {
  const error = new Error(
    `Deluge added torrent ${localId}, but failed to apply its options: ${cause.message}`
  )
  error.cause = cause
  return error
}

function numeric(value, name) {
  value = Number(value)
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number`)
  return value
}

function nonNegative(value, name) {
  value = numeric(value, name)
  if (value < 0) throw new Error(`${name} must be non-negative`)
  return value
}

function validateVersion(version) {
  const match = `${version || ``}`.match(/(?:^|\s)(\d+)\./)
  if (!match || Number(match[1]) !== 2) {
    throw new Error(
      `Unsupported Deluge daemon version "${version || `unknown`}"; Gearbox requires Deluge 2.x`
    )
  }
  return version
}

function patchChanged(existing, patch) {
  return Object.entries(patch).some(
    ([field, value]) => !deepEqual(existing[field], value)
  )
}

const SESSION_FIELDS = {
  "download-dir": {
    key: `download_location`,
    map: (value) => `${value || ``}`,
  },
  "peer-limit-global": {
    key: `max_connections_global`,
    map: (value) => Number(value) || 0,
  },
  "peer-limit-per-torrent": {
    key: `max_connections_per_torrent`,
    map: (value) => Number(value) || 0,
  },
  "speed-limit-down": {
    key: `max_download_speed`,
    map: (value) => Math.max(0, Number(value) || 0),
  },
  "speed-limit-down-enabled": {
    key: `max_download_speed`,
    map: (value) => Number(value) >= 0,
  },
  "speed-limit-up": {
    key: `max_upload_speed`,
    map: (value) => Math.max(0, Number(value) || 0),
  },
  "speed-limit-up-enabled": {
    key: `max_upload_speed`,
    map: (value) => Number(value) >= 0,
  },
  "start-added-torrents": {
    key: `add_paused`,
    map: (value) => value !== true,
  },
}
