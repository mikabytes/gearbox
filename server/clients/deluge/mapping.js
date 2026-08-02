export const STOPPED = 0
export const CHECK_WAIT = 1
export const CHECK = 2
export const DOWNLOAD_WAIT = 3
export const DOWNLOAD = 4
export const SEED_WAIT = 5
export const SEED = 6

// web.update_ui retrieves these in one daemon call. Files, trackers and the
// Label plugin value are bulk status keys, so startup never fans out into a
// request per torrent.
export const STATUS_KEYS = [
  `active_time`,
  `all_time_download`,
  `comment`,
  `completed_time`,
  `download_location`,
  `download_payload_rate`,
  `eta`,
  `file_priorities`,
  `file_progress`,
  `files`,
  `hash`,
  `is_finished`,
  `is_seed`,
  `label`,
  `magnet_uri`,
  `max_connections`,
  `max_download_speed`,
  `max_upload_speed`,
  `message`,
  `name`,
  `next_announce`,
  `num_peers`,
  `num_pieces`,
  `num_seeds`,
  `paused`,
  `peers`,
  `piece_length`,
  `private`,
  `progress`,
  `queue`,
  `ratio`,
  `save_path`,
  `seeding_time`,
  `sequential_download`,
  `state`,
  `stop_at_ratio`,
  `stop_ratio`,
  `time_added`,
  `total_done`,
  `total_failed_bytes`,
  `total_peers`,
  `total_seeds`,
  `total_size`,
  `total_uploaded`,
  `total_wanted`,
  `tracker`,
  `tracker_host`,
  `tracker_status`,
  `trackers`,
  `upload_payload_rate`,
]

export function mapTorrent(localId, source = {}, { now = Date.now } = {}) {
  const hashString = `${source.hash || localId || ``}`.toLowerCase()
  const percentDone = clamp(number(source.progress) / 100, 0, 1)
  const status = mapStatus(source.state, percentDone, source)
  const totalSize = number(source.total_size)
  const sizeWhenDone = number(source.total_wanted, totalSize)
  const downloaded = number(source.total_done)
  const uploaded = number(source.total_uploaded)
  const peers = mapPeers(source.peers)
  const files = mapFiles(source.files, source.file_progress)
  const delugePriorities = normalizePriorities(source.file_priorities, files.length)
  const priorities = delugePriorities.map(toTransmissionPriority)
  const wanted = delugePriorities.map((priority) => priority !== 0)
  const trackers = mapTrackers(source.trackers, source.tracker)
  const trackerStatus = `${source.tracker_status || ``}`
  const localError = `${source.message || ``}`
  const stateError = `${source.state || ``}`.toLowerCase() === `error`
  const trackerError = /^error\b/i.test(trackerStatus)
  const error = stateError ? 3 : trackerError ? 2 : 0
  const errorString = stateError ? localError || `Deluge reported an error` : trackerError ? trackerStatus : ``
  const ratio = number(source.ratio, downloaded ? uploaded / downloaded : 0)
  const downloadLimit = number(source.max_download_speed, -1)
  const uploadLimit = number(source.max_upload_speed, -1)
  const addedDate = seconds(source.time_added)
  const doneDate = seconds(source.completed_time)
  const rateDownload = number(source.download_payload_rate)
  const rateUpload = number(source.upload_payload_rate)
  const checking = status === CHECK || status === CHECK_WAIT
  const isFinished = source.is_finished === true || percentDone >= 1

  return {
    activityDate: rateDownload || rateUpload ? Math.floor(now() / 1000) : doneDate || addedDate,
    addedDate,
    comment: `${source.comment || ``}`,
    corruptEver: number(source.total_failed_bytes),
    doneDate,
    downloadDir: `${source.download_location || source.save_path || ``}`,
    downloadedEver: number(source.all_time_download, downloaded),
    downloadLimit: downloadLimit < 0 ? 0 : downloadLimit,
    downloadLimited: downloadLimit >= 0,
    error,
    errorString,
    eta: normalizeEta(source.eta),
    files,
    fileStats: files.map((file, index) => ({
      bytesCompleted: file.bytesCompleted,
      priority: priorities[index],
      wanted: wanted[index],
    })),
    [`file-count`]: files.length,
    group: `${source.label || ``}`,
    hashString,
    haveUnchecked: checking ? downloaded : 0,
    haveValid: checking ? 0 : downloaded,
    honorsSessionLimits: true,
    isFinished,
    isPrivate: source.private === true,
    isStalled:
      (status === DOWNLOAD || status === SEED) && !rateDownload && !rateUpload,
    labels: source.label ? [`${source.label}`] : [],
    leftUntilDone: Math.max(0, sizeWhenDone - downloaded),
    magnetLink: `${source.magnet_uri || ``}`,
    manualAnnounceTime: number(source.next_announce)
      ? Math.floor(now() / 1000) + number(source.next_announce)
      : 0,
    maxConnectedPeers: number(source.max_connections),
    metadataPercentComplete: source.name ? 1 : 0,
    name: `${source.name || hashString}`,
    [`peer-limit`]: number(source.max_connections),
    peers,
    peersConnected: number(source.num_peers, peers.length),
    peersGettingFromUs: peers.filter((peer) => peer.rateToPeer > 0).length,
    peersSendingToUs: peers.filter((peer) => peer.rateToClient > 0).length,
    percentComplete: percentDone,
    percentDone,
    pieceCount: number(source.num_pieces),
    pieceSize: number(source.piece_length),
    priorities,
    queuePosition: number(source.queue),
    rateDownload,
    rateUpload,
    recheckProgress: checking ? percentDone : 0,
    secondsDownloading: Math.max(
      0,
      number(source.active_time) - number(source.seeding_time)
    ),
    secondsSeeding: number(source.seeding_time),
    seedRatioLimit: number(source.stop_ratio),
    seedRatioMode: source.stop_at_ratio === true ? 1 : 2,
    sequentialDownload: source.sequential_download === true,
    sizeWhenDone,
    startDate: addedDate,
    status,
    totalSize,
    trackers,
    trackerList: trackers.map((tracker) => tracker.announce).join(`\n`),
    trackerStats: trackers.map((tracker, index) => ({
      announce: tracker.announce,
      announceState: index === 0 && trackerError ? 4 : 2,
      id: tracker.id,
      host: tracker.announce,
      leecherCount:
        index === 0 ? number(source.total_peers, -1) : -1,
      lastAnnounceResult: index === 0 ? trackerStatus : ``,
      seederCount:
        index === 0 ? number(source.total_seeds, -1) : -1,
      tier: tracker.tier,
    })),
    uploadedEver: uploaded,
    uploadLimit: uploadLimit < 0 ? 0 : uploadLimit,
    uploadLimited: uploadLimit >= 0,
    uploadRatio: ratio < 0 ? 0 : ratio,
    wanted,
  }
}

export function mapStatus(state, percentDone = 0, source = {}) {
  switch (`${state || ``}`.toLowerCase()) {
    case `checking`:
    case `checking resume data`:
      return CHECK
    case `downloading`:
      return DOWNLOAD
    case `seeding`:
      return SEED
    case `queued`:
      return source.is_seed === true || percentDone >= 1 ? SEED_WAIT : DOWNLOAD_WAIT
    case `allocating`:
      return DOWNLOAD_WAIT
    default:
      return STOPPED
  }
}

export function applyFileSelection(current, args, torrentId = ``) {
  const priorities = [...current]
  const fields = [
    `filesWanted`,
    `filesUnwanted`,
    `priority-low`,
    `priority-normal`,
    `priority-high`,
  ]

  for (const field of fields) {
    if (args[field] !== undefined && !Array.isArray(args[field])) {
      throw new Error(`${field} must be an array for Deluge torrent ${torrentId}`)
    }
  }

  if (args.filesWanted) {
    priorities.fill(0)
    for (const index of checkedIndices(args.filesWanted, priorities.length, torrentId)) {
      priorities[index] = current[index] || 4
    }
  }

  for (const [field, priority] of [
    [`priority-low`, 1],
    [`priority-normal`, 4],
    [`priority-high`, 7],
  ]) {
    for (const index of checkedIndices(args[field] || [], priorities.length, torrentId)) {
      priorities[index] = priority
    }
  }

  for (const index of checkedIndices(
    args.filesUnwanted || [],
    priorities.length,
    torrentId
  )) {
    priorities[index] = 0
  }

  return priorities
}

function checkedIndices(indices, length, torrentId) {
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index >= length) {
      throw new Error(
        `Invalid file index ${index} for Deluge torrent ${torrentId || `(new torrent)`}`
      )
    }
  }
  return indices
}

function mapFiles(files, progress) {
  if (!Array.isArray(files)) return []
  const progresses = Array.isArray(progress) ? progress : []
  return files.map((file, index) => {
    const length = number(file?.size ?? file?.length)
    let complete = number(progresses[index])
    if (complete > 1) complete /= 100
    return {
      index: Number.isInteger(file?.index) ? file.index : index,
      name: `${file?.path || file?.name || ``}`,
      length,
      bytesCompleted: Math.round(length * clamp(complete, 0, 1)),
    }
  })
}

function normalizePriorities(priorities, length) {
  if (!Array.isArray(priorities)) return Array(length).fill(4)
  return Array.from({ length }, (_, index) => number(priorities[index], 4))
}

function toTransmissionPriority(priority) {
  if (priority === 0) return 0
  if (priority <= 1) return -1
  if (priority >= 7) return 1
  return 0
}

function mapTrackers(trackers, primary) {
  const entries = Array.isArray(trackers) ? [...trackers] : []
  if (!entries.length && primary) entries.push({ url: primary, tier: 0 })
  return entries
    .map((tracker, index) => ({
      id: index,
      announce: `${tracker?.url || tracker?.announce || ``}`,
      scrape: ``,
      tier: number(tracker?.tier),
    }))
    .filter((tracker) => tracker.announce)
}

function mapPeers(peers) {
  if (!Array.isArray(peers)) return []
  return peers.map((peer) => {
    let progress = number(peer?.progress)
    if (progress > 1) progress /= 100
    return {
      address: `${peer?.ip || ``}`,
      clientName: `${peer?.client || ``}`,
      clientIsChoked: peer?.seed === true,
      clientIsInterested: number(peer?.up_speed) > 0,
      flagStr: `${peer?.country || ``}`,
      isDownloadingFrom: number(peer?.down_speed) > 0,
      isUploadingTo: number(peer?.up_speed) > 0,
      peerIsChoked: false,
      peerIsInterested: number(peer?.down_speed) > 0,
      port: number(peer?.port),
      progress: clamp(progress, 0, 1),
      rateToClient: number(peer?.down_speed),
      rateToPeer: number(peer?.up_speed),
    }
  })
}

function normalizeEta(value) {
  value = number(value, -1)
  return value >= 0 && value < 2 ** 31 ? value : -1
}

function seconds(value) {
  value = number(value)
  return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value)
}

function number(value, fallback = 0) {
  value = Number(value)
  return Number.isFinite(value) ? value : fallback
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}
