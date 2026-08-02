export const STOPPED = 0
export const CHECK_WAIT = 1
export const CHECK = 2
export const DOWNLOAD_WAIT = 3
export const DOWNLOAD = 4
export const SEED_WAIT = 5
export const SEED = 6

export function mapTorrent(native, details = {}) {
  const state = native.state || `unknown`
  const progress = finite(native.progress)
  const totalSize = positive(native.total_size, positive(native.size))
  const sizeWhenDone = positive(native.size, totalSize)
  const downloadLimit = native.dl_limit > 0 ? Math.round(native.dl_limit / 1000) : 0
  const uploadLimit = native.up_limit > 0 ? Math.round(native.up_limit / 1000) : 0
  const status = mapStatus(state, progress)
  const error = state === `error` || state === `missingFiles` ? 3 : 0
  const tags = `${native.tags || ``}`
    .split(`,`)
    .map((tag) => tag.trim())
    .filter(Boolean)
  const labels = native.category ? [...tags, native.category] : tags
  const summaryTracker = native.tracker
    ? [{ announce: native.tracker }]
    : []
  const summaryStats = native.tracker
    ? [
        {
          announce: native.tracker,
          leecherCount: finite(native.num_incomplete, -1),
          seederCount: finite(native.num_complete, -1),
        },
      ]
    : []
  const trackerDetails = details.trackers
  const fileDetails = details.files
  const activeTime = positive(native.time_active)
  const seedingTime = positive(native.seeding_time)
  const ratio = shareLimit(native.ratio_limit ?? native.max_ratio)
  const idle = shareLimit(minutes(native.inactive_seeding_time_limit))

  return {
    activityDate: positive(native.last_activity),
    addedDate: positive(native.added_on),
    corruptEver: 0,
    desiredAvailable: 0,
    doneDate: positive(native.completion_on),
    downloadDir: `${native.save_path || ``}`,
    downloadedEver: positive(native.downloaded),
    downloadLimit,
    downloadLimited: native.dl_limit > 0,
    error,
    errorString:
      state === `missingFiles`
        ? `Local data files are missing`
        : state === `error`
          ? `qBittorrent reported a torrent error`
          : ``,
    eta: finite(native.eta) >= 8640000 ? -1 : finite(native.eta),
    files: fileDetails?.files || [],
    fileStats: fileDetails?.fileStats || [],
    [`file-count`]: fileDetails?.files?.length || 0,
    group: `${native.category || ``}`,
    hashString: `${native.hash || ``}`.toLowerCase(),
    honorsSessionLimits: true,
    haveValid: positive(native.completed),
    isFinished: progress >= 1 || isUploadState(state),
    isPrivate: native.isPrivate === true || native.is_private === true,
    isStalled: state === `stalledDL` || state === `stalledUP`,
    labels,
    leftUntilDone: positive(native.amount_left),
    magnetLink: `${native.magnet_uri || ``}`,
    metadataPercentComplete: state === `metaDL` ? 0 : native.name ? 1 : 0,
    name: `${native.name || native.hash || ``}`,
    peersConnected: positive(native.num_leechs) + positive(native.num_seeds),
    peersGettingFromUs: positive(native.num_leechs),
    peersSendingToUs: positive(native.num_seeds),
    percentComplete: progress,
    percentDone: progress,
    priorities: fileDetails?.priorities || [],
    queuePosition: native.priority > 0 ? native.priority - 1 : 0,
    rateDownload: positive(native.dlspeed),
    rateUpload: positive(native.upspeed),
    recheckProgress: status === CHECK ? finite(native.recheck_progress) : 0,
    secondsDownloading: Math.max(0, activeTime - seedingTime),
    secondsSeeding: seedingTime,
    seedIdleLimit: idle.limit,
    seedIdleMode: idle.mode,
    seedRatioLimit: ratio.limit,
    seedRatioMode: ratio.mode,
    sequentialDownload: native.seq_dl === true,
    sizeWhenDone,
    status,
    totalSize,
    torrentFile: `${details.torrentFile || ``}`,
    localTorrentFile: `${details.localTorrentFile || ``}`,
    trackers: trackerDetails?.trackers || summaryTracker,
    trackerList:
      trackerDetails?.trackerList || summaryTracker.map((it) => it.announce).join(`\n`),
    trackerStats: trackerDetails?.trackerStats || summaryStats,
    uploadedEver: positive(native.uploaded),
    uploadLimit,
    uploadLimited: native.up_limit > 0,
    uploadRatio: finite(native.ratio),
    wanted: fileDetails?.wanted || [],
  }
}

export function mapFiles(files = []) {
  const normalized = files.map((file, position) => {
    const index = Number.isInteger(file.index) ? file.index : position
    const length = positive(file.size)
    const bytesCompleted = Math.round(length * finite(file.progress))
    return {
      index,
      name: `${file.name || ``}`,
      length,
      bytesCompleted,
      priority: file.priority,
    }
  })

  return {
    files: normalized.map(({ priority, ...file }) => file),
    fileStats: normalized.map((file) => ({
      bytesCompleted: file.bytesCompleted,
      wanted: file.priority > 0,
      priority: file.priority >= 6 ? 1 : 0,
    })),
    priorities: normalized.map((file) => (file.priority >= 6 ? 1 : 0)),
    wanted: normalized.map((file) => file.priority > 0),
  }
}

export function mapTrackers(trackers = []) {
  trackers = trackers.filter(
    (tracker) =>
      tracker?.url &&
      (!Number.isFinite(tracker.tier) || tracker.tier >= 0) &&
      !tracker.url.startsWith(`**`)
  )
  const normalized = trackers.map((tracker, index) => ({
    id: index,
    tier: tracker.tier,
    announce: tracker.url,
  }))

  return {
    trackers: normalized,
    trackerList: normalized.map((tracker) => tracker.announce).join(`\n`),
    trackerStats: trackers.map((tracker, index) => ({
      id: index,
      tier: tracker.tier,
      announce: tracker.url,
      announceState: tracker.status === 3 ? 3 : tracker.status === 2 ? 1 : 0,
      hasAnnounced: tracker.status >= 2,
      lastAnnounceSucceeded: tracker.status === 2,
      lastAnnounceResult: `${tracker.msg || ``}`,
      leecherCount: finite(tracker.num_leeches, -1),
      seederCount: finite(tracker.num_seeds, -1),
      downloadCount: finite(tracker.num_downloaded, -1),
    })),
  }
}

export function mapStatus(state, progress = 0) {
  if ([`checkingUP`, `checkingDL`, `checkingResumeData`].includes(state)) {
    return CHECK
  }
  if (state === `queuedUP`) return SEED_WAIT
  if (state === `queuedDL`) return DOWNLOAD_WAIT
  if ([`pausedUP`, `pausedDL`, `stoppedUP`, `stoppedDL`, `error`, `missingFiles`].includes(state)) {
    return STOPPED
  }
  if ([`uploading`, `stalledUP`, `forcedUP`].includes(state)) return SEED
  if (
    [`allocating`, `downloading`, `metaDL`, `stalledDL`, `forcedDL`].includes(
      state
    )
  ) {
    return DOWNLOAD
  }
  if (state === `moving`) return progress >= 1 ? SEED : DOWNLOAD
  return progress >= 1 ? SEED : STOPPED
}

function shareLimit(value) {
  if (value === -2 || value === undefined || value === null) {
    return { mode: 0, limit: 0 }
  }
  if (value < 0) return { mode: 2, limit: 0 }
  return { mode: 1, limit: finite(value) }
}

function minutes(value) {
  if (!Number.isFinite(value) || value < 0) return value
  return Math.round(value / 60)
}

function isUploadState(state) {
  return /UP$/.test(state) || [`uploading`, `forcedUP`, `stalledUP`].includes(state)
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

function positive(value, fallback = 0) {
  value = finite(value, fallback)
  return value > 0 ? value : fallback
}
