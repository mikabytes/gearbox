export default function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024 / 1024).toFixed(1)} T`
  }

  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} G`
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} M`
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} K`
  }

  return `${bytes} B`
}
