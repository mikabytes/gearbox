// Import the necessary modules
import torrentName from "./torrentNames.js"
import * as guid from "../../guid.js"
import * as bencode from "../../../public/bencode.js"

export const STOPPED = 0
export const CHECK_WAIT = 1
export const CHECK = 2
export const DOWNLOAD_WAIT = 3
export const DOWNLOAD = 4
export const SEED_WAIT = 5
export const SEED = 6

let labels = `sonarr radarr autobrr lidarr`.split(" ")

// The demo adapter
export default function DemoAdapter({ id: clientId, changes: _changes }) {
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

  // Helper function to process torrents
  function processTorrent(torrent) {
    const name = torrentName()
    const localId = ++torrentIdCounter
    return {
      id: guid.encode({ clientId, torrentId: localId }),
      localId,
      clientId,
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
      peers: [],
      trackerStats: [],
      uploadRatio: 0,
      totalSize: Math.floor(Math.random() * 10000000),
      peersGettingFromUs: 0,
      peersSendingToUs: 0,
      ...torrent,
    }
  }

  function simulateTorrentProgress(torrentId) {
    const torrent = torrents.get(torrentId)
    if (!torrent) return

    const changeSet = {}

    const progressRate = Math.random() * 0.03 + 0.01 // Random progress rate between 0.05 and 0.15
    if (torrent.percentDone < 1.0) {
      changeSet.percentDone = Math.min(torrent.percentDone + progressRate, 1.0)
      const seederCount = Math.floor(Math.random() * 10)
      changeSet.peers = [
        {
          rateToClient: Math.round(progressRate * 100000),
          rateToPeer: 0,
        },
      ]
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
    torrents.set(newTorrent.localId, newTorrent)
    schedule(
      newTorrent.localId,
      () => simulateTorrentProgress(newTorrent.localId),
      1000
    )
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
      return
    }

    const { ids } = args

    for (const id of ids) {
      const torrent = torrents.get(id)
      if (!torrent) {
        throw new Error(`Torrent ${JSON.stringify(id)} not found`)
      }
      switch (method) {
        case "torrent-remove":
          console.log(`${clientId}: Deleting ${id}`)
          torrents.delete(id)
          clearSchedule(id)
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
            id,
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
            schedule(id, () => simulateTorrentProgress(id), 1000)
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
  }
}
