import fields from "../fields.js"

const numericFields = new Set([
  `activityDate`,
  `addedDate`,
  `bandwidthPriority`,
  `corruptEver`,
  `dateCreated`,
  `desiredAvailable`,
  `doneDate`,
  `downloadedEver`,
  `downloadLimit`,
  `editDate`,
  `error`,
  `eta`,
  `etaIdle`,
  `file-count`,
  `haveUnchecked`,
  `haveValid`,
  `id`,
  `leftUntilDone`,
  `manualAnnounceTime`,
  `maxConnectedPeers`,
  `metadataPercentComplete`,
  `peer-limit`,
  `peersConnected`,
  `peersGettingFromUs`,
  `peersSendingToUs`,
  `percentComplete`,
  `percentDone`,
  `pieceCount`,
  `pieceSize`,
  `queuePosition`,
  `rateDownload`,
  `rateUpload`,
  `recheckProgress`,
  `secondsDownloading`,
  `secondsSeeding`,
  `seedIdleLimit`,
  `seedIdleMode`,
  `seedRatioLimit`,
  `seedRatioMode`,
  `sizeWhenDone`,
  `startDate`,
  `status`,
  `totalSize`,
  `uploadedEver`,
  `uploadLimit`,
  `uploadRatio`,
  `webseedsSendingToUs`,
])

const booleanFields = new Set([
  `downloadLimited`,
  `honorsSessionLimits`,
  `isFinished`,
  `isPrivate`,
  `isStalled`,
  `sequentialDownload`,
  `uploadLimited`,
])

const arrayFields = new Set([
  `files`,
  `fileStats`,
  `labels`,
  `peers`,
  `peersFrom`,
  `priorities`,
  `trackers`,
  `trackerStats`,
  `wanted`,
  `webseeds`,
])

const stringFields = new Set([
  `comment`,
  `creator`,
  `downloadDir`,
  `errorString`,
  `group`,
  `hashString`,
  `magnetLink`,
  `name`,
  `primary-mime-type`,
  `torrentFile`,
  `trackerList`,
])

const defaults = Object.fromEntries(
  fields.map((field) => {
    if (numericFields.has(field)) return [field, 0]
    if (booleanFields.has(field)) return [field, false]
    if (arrayFields.has(field)) return [field, []]
    if (stringFields.has(field)) return [field, ``]
    return [field, null]
  })
)

export default function normalizeTorrent(torrent, identity = {}) {
  const hasPercentComplete = Number.isFinite(torrent.percentComplete)
  const hasMetadataPercentComplete = Number.isFinite(
    torrent.metadataPercentComplete
  )
  const ret = {
    ...defaults,
    ...torrent,
    ...identity,
  }

  for (const field of numericFields) {
    if (!Number.isFinite(ret[field])) ret[field] = 0
  }

  for (const field of booleanFields) {
    ret[field] = ret[field] === true
  }

  for (const field of arrayFields) {
    if (!Array.isArray(ret[field])) ret[field] = []
  }

  for (const field of stringFields) {
    if (ret[field] === undefined || ret[field] === null) ret[field] = ``
  }

  ret.files = ret.files.map(normalizeFile)
  ret.trackers = ret.trackers.map(normalizeTracker).filter(Boolean)
  ret.trackerStats = ret.trackerStats.map(normalizeTrackerStats)
  ret.labels = [...new Set(ret.labels.filter(Boolean).map(String))]

  if (!ret[`file-count`]) ret[`file-count`] = ret.files.length
  if (!ret.sizeWhenDone) ret.sizeWhenDone = ret.totalSize
  if (!hasPercentComplete) ret.percentComplete = ret.percentDone
  if (!hasMetadataPercentComplete && ret.name) {
    ret.metadataPercentComplete = 1
  }

  return ret
}

function normalizeFile(file, index) {
  if (typeof file === `string`) {
    return { name: file, length: 0, bytesCompleted: 0, index }
  }

  return {
    ...file,
    name: `${file?.name || file?.path || ``}`,
    length: finite(file?.length ?? file?.size),
    bytesCompleted: finite(file?.bytesCompleted),
    index: Number.isInteger(file?.index) ? file.index : index,
  }
}

function normalizeTracker(tracker) {
  if (!tracker) return null
  if (typeof tracker === `string`) tracker = { announce: tracker }

  const announce = `${tracker.announce || tracker.url || ``}`
  return {
    ...tracker,
    announce,
    sitename: `${tracker.sitename || trackerSite(announce)}`,
  }
}

function normalizeTrackerStats(stats) {
  const announce = `${stats?.announce || stats?.url || ``}`
  return {
    ...stats,
    announce,
    announceState: finite(stats?.announceState),
    downloadCount: finite(stats?.downloadCount, -1),
    hasAnnounced: boolean(stats?.hasAnnounced),
    hasScraped: boolean(stats?.hasScraped),
    host: `${stats?.host || trackerSite(announce)}`,
    id: finite(stats?.id),
    isBackup: boolean(stats?.isBackup),
    lastAnnouncePeerCount: finite(stats?.lastAnnouncePeerCount, -1),
    lastAnnounceResult: `${stats?.lastAnnounceResult || ``}`,
    lastAnnounceStartTime: finite(stats?.lastAnnounceStartTime),
    lastAnnounceSucceeded: boolean(stats?.lastAnnounceSucceeded),
    lastAnnounceTime: finite(stats?.lastAnnounceTime),
    lastAnnounceTimedOut: boolean(stats?.lastAnnounceTimedOut),
    lastScrapeResult: `${stats?.lastScrapeResult || ``}`,
    lastScrapeStartTime: finite(stats?.lastScrapeStartTime),
    lastScrapeSucceeded: boolean(stats?.lastScrapeSucceeded),
    lastScrapeTime: finite(stats?.lastScrapeTime),
    lastScrapeTimedOut: boolean(stats?.lastScrapeTimedOut),
    leecherCount: finite(stats?.leecherCount ?? stats?.num_leeches, -1),
    nextAnnounceTime: finite(stats?.nextAnnounceTime),
    nextScrapeTime: finite(stats?.nextScrapeTime),
    scrape: `${stats?.scrape || ``}`,
    scrapeState: finite(stats?.scrapeState),
    seederCount: finite(stats?.seederCount ?? stats?.num_seeds, -1),
    sitename: `${stats?.sitename || trackerSite(announce)}`,
    tier: finite(stats?.tier),
  }
}

export function trackerSite(url) {
  if (!url) return ``

  try {
    const parsed = new URL(url.replace(/^udp:/, `http:`))
    return parsed.hostname || url
  } catch {
    return url
  }
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

function boolean(value) {
  return value === true || value === 1
}
