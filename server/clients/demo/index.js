// Import the necessary modules
import torrentName from "./torrentNames.js"
import * as guid from "../../guid.js"
import * as bencode from "../../../public/bencode.js"
import { capabilities } from "../contract.js"
import normalizeTorrent from "../shared/normalizeTorrent.js"

export const STOPPED = 0
export const CHECK_WAIT = 1
export const CHECK = 2
export const DOWNLOAD_WAIT = 3
export const DOWNLOAD = 4
export const SEED_WAIT = 5
export const SEED = 6

let labels = `sonarr radarr autobrr lidarr`.split(" ")

// The demo adapter
export default function DemoAdapter({ id: clientId }, dependencies = {}) {
  const _changes = dependencies.changes
  let buffer = new Map()
  function changes({ id, changeSet, isRemoved }) {
    const entry = buffer.get(id) || {}

    if (changeSet) {
      if (entry.changeSet) {
        Object.assign(entry.changeSet, changeSet)
      } else {
        entry.changeSet = changeSet
      }
    }

    if (isRemoved) {
      entry.isRemoved = true
    }
    buffer.set(id, entry)
  }
  function flush() {
    for (const id of buffer.keys()) {
      const entry = buffer.get(id)
      if (entry.isRemoved) {
        _changes({ id, isRemoved: true })
      } else {
        _changes({ id, changeSet: entry.changeSet })
      }
    }
    buffer = new Map()
  }
  setInterval(flush, 1000)

  let torrentIdCounter = 0
  const torrents = new Map()
  const updateIntervals = new Map()

  function makeFiles(name, totalSize) {
    const count = 1 + Math.floor(Math.random() * 4)
    const base = name.replace(/\.[a-z0-9]+$/i, ``)
    const files = []
    let remaining = totalSize
    for (let i = 0; i < count; i++) {
      const last = i === count - 1
      const length = last
        ? remaining
        : Math.max(1, Math.floor((remaining / (count - i)) * (0.5 + Math.random())))
      remaining = Math.max(0, remaining - length)
      files.push({
        name: count === 1 ? name : `${base}/part-${i + 1}.bin`,
        length,
        bytesCompleted: 0,
      })
    }
    return files
  }

  // Helper function to process torrents
  function processTorrent(torrent) {
    const name = torrentName()
    const localId = ++torrentIdCounter
    const totalSize = torrent.totalSize ?? Math.floor(Math.random() * 10000000)
    const files = torrent.files ?? makeFiles(torrent.name ?? name, totalSize)
    return normalizeTorrent({
      id: guid.encode({ clientId, torrentId: localId }),
      localId,
      clientId,
      clientType: `demo`,
      status: DOWNLOAD,
      percentDone: 0,
      recheckProgress: 0,
      name,
      addedDate: Date.now() / 1000,
      labels: [labels[Math.floor(Math.random() * labels.length)]],
      trackers: [
        {
          sitename: name.slice(0, 1) + `-tracker`,
        },
      ],
      rateDownload: 0,
      trackerStats: [],
      uploadRatio: 0,
      totalSize,
      files,
      fileStats: files.map((file) => ({
        bytesCompleted: file.bytesCompleted,
        priority: 0,
        wanted: true,
      })),
      peersGettingFromUs: 0,
      peersSendingToUs: 0,
      ...torrent,
    })
  }

  function simulateTorrentProgress(torrentId) {
    const torrent = torrents.get(torrentId)
    if (!torrent) return

    const changeSet = {}

    const progressRate = Math.random() * 0.03 + 0.01 // Random progress rate between 0.05 and 0.15
    if (torrent.percentDone < 1.0) {
      changeSet.percentDone = Math.min(torrent.percentDone + progressRate, 1.0)
      const seederCount = Math.floor(Math.random() * 10)
      changeSet.rateDownload = Math.round(progressRate * 100000)
      changeSet.trackerStats = [
        {
          leecherCount: Math.floor(Math.random() * 3),
          seederCount,
        },
      ]
      changeSet.peersSendingToUs = Math.floor(Math.random() * seederCount)
    } else {
      changeSet.status = SEED
      clearInterval(updateIntervals.get(torrentId))
      updateIntervals.delete(torrentId)
    }

    Object.assign(torrent, changeSet)

    changes?.({
      id: torrent.id,
      changeSet,
    })
  }

  function addTorrent(args = {}) {
    const newTorrent = processTorrent(args)
    torrents.set(newTorrent.id, newTorrent)
    schedule(newTorrent.id, () => simulateTorrentProgress(newTorrent.id), 1000)
    changes?.({ id: newTorrent.id, changeSet: newTorrent })
  }

  function schedule(id, work, interval) {
    let intervalId = updateIntervals.get(id)
    if (intervalId) {
      clearInterval(intervalId)
    }
    updateIntervals.set(id, setInterval(work, interval))
  }

  function clearSchedule(id) {
    const intervalId = updateIntervals.get(id)
    if (intervalId) {
      clearInterval(intervalId)
      updateIntervals.delete(id)
    }
  }

  // Emulate the request interface
  function request(method, args) {
    if (method === `torrent-add`) {
      const data = bencode.decode(atob(args.metainfo))
      addTorrent({
        name: data.info.name,
        totalSize:
          data.info.length || data.info.files.reduce((a, b) => a + b.length, 0),
      })
      return { result: `success`, arguments: {} }
    }

    const { ids } = args
    const byLocalId = new Map()
    for (const torrent of torrents.values()) {
      byLocalId.set(torrent.localId, torrent)
    }

    for (const id of ids) {
      const torrent = byLocalId.get(id)
      if (!torrent) {
        throw new Error(`Torrent ${JSON.stringify(id)} not found`)
      }
      switch (method) {
        case "torrent-remove":
          torrents.delete(torrent.id)
          clearSchedule(torrent.id)
          setTimeout(() => {
            changes?.({ id: torrent.id, isRemoved: true })
          }, 700)
          break
        case "torrent-verify":
          torrent.recheckProgress = 0
          torrent.status = CHECK
          changes?.({
            id: torrent.id,
            changeSet: { status: CHECK, recheckProgress: 0 },
          })
          // Emulate recheck progress similarly to download progress
          schedule(
            torrent.id,
            () => {
              torrent.recheckProgress = Math.min(
                torrent.recheckProgress + Math.random() * 0.1 + 0.05,
                1
              ) // Random progress
              changes?.({
                id: torrent.id,
                changeSet: { recheckProgress: torrent.recheckProgress },
              })
              if (torrent.recheckProgress === 1) {
                torrent.status = SEED
                changes?.({ id: torrent.id, changeSet: { status: SEED } })
                clearSchedule(id)
              }
            },
            1000
          )
          break
        case "torrent-start":
          if (torrent.percentDone < 100) {
            torrent.status = DOWNLOAD
            changes?.({ id: torrent.id, changeSet: { status: DOWNLOAD } })
            schedule(
              torrent.id,
              () => simulateTorrentProgress(torrent.id),
              1000
            )
            console.log(`resuming`)
          } else {
            console.log(`seeding`)
            torrent.status = SEED
            changes?.({ id: torrent.id, changeSet: { status: SEED } })
          }
          break
        case "torrent-stop":
          clearSchedule(id)
          torrent.status = STOPPED
          changes?.({ id: torrent.id, changeSet: { status: STOPPED } })
          break
        case "torrent-set": {
          const stats = torrent.fileStats ?? []
          const applyTo = (indices, change) => {
            for (const index of indices ?? []) {
              if (stats[index]) {
                change(stats[index])
              }
            }
          }
          applyTo(args[`files-wanted`], (stat) => (stat.wanted = true))
          applyTo(args[`files-unwanted`], (stat) => (stat.wanted = false))
          applyTo(args[`priority-low`], (stat) => (stat.priority = -1))
          applyTo(args[`priority-normal`], (stat) => (stat.priority = 0))
          applyTo(args[`priority-high`], (stat) => (stat.priority = 1))
          torrent.fileStats = stats.map((stat) => ({ ...stat }))
          changes?.({
            id: torrent.id,
            changeSet: { fileStats: torrent.fileStats },
          })
          break
        }
        default:
          console.log(`Method ${method} is not supported.`)
      }
    }

    return { result: `success` }
  }

  setInterval(addTorrent, 10000 + Math.floor(Math.random() * 10000))
  addTorrent()

  console.log(`Starting demo client ${clientId}...`)
  return {
    id: clientId,
    type: `demo`,
    capabilities: capabilities({
      addTorrent: true,
      removeTorrents: true,
      setTorrents: true,
      startTorrents: true,
      stopTorrents: true,
      verifyTorrents: true,
      sessionGet: true,
    }),
    request,
    count() {
      return torrents.size
    },
    get(id) {
      return torrents.get(id)
    },
    getAll() {
      return Array.from(torrents.values())
    },
    getRecent() {
      return [][Symbol.iterator]()
    },
    async addTorrent(args) {
      request(`torrent-add`, args)
      return {}
    },
    async setTorrents(ids, args) {
      request(`torrent-set`, { ids, ...args })
      return {}
    },
    async removeTorrents(ids, args) {
      request(`torrent-remove`, { ...args, ids })
      return {}
    },
    async startTorrents(ids, args) {
      request(`torrent-start`, { ...args, ids })
      return {}
    },
    async stopTorrents(ids, args) {
      request(`torrent-stop`, { ...args, ids })
      return {}
    },
    async verifyTorrents(ids, args) {
      request(`torrent-verify`, { ...args, ids })
      return {}
    },
    async sessionGet() {
      return { "download-dir": `/torrents` }
    },
  }
}
