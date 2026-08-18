// Maps between per-file UI priority levels and Transmission torrent-set
// arguments. Levels span the full range every connector understands:
// skip (don't download) up to maximum.

export const LEVELS = [
  { id: `skip`, name: `Skip` },
  { id: `low`, name: `Low` },
  { id: `normal`, name: `Normal` },
  { id: `high`, name: `Maximum` },
]

export function fileLevel(stat = {}) {
  if (stat.wanted === false) {
    return `skip`
  }
  if (stat.priority < 0) {
    return `low`
  }
  if (stat.priority > 0) {
    return `high`
  }
  return `normal`
}

export function levelArguments(level, index) {
  switch (level) {
    case `skip`:
      return { "files-unwanted": [index] }
    case `low`:
      return { "files-wanted": [index], "priority-low": [index] }
    case `high`:
      return { "files-wanted": [index], "priority-high": [index] }
    default:
      return { "files-wanted": [index], "priority-normal": [index] }
  }
}
