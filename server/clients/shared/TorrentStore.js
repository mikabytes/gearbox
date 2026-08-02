import fs from "fs/promises"
import path from "path"

export default async function TorrentStore({ workdir, logger, fileSystem = fs }) {
  const directory = path.join(workdir, `torrents`)
  await fileSystem.mkdir(directory, { recursive: true })

  function filename(clientId, hash) {
    return path.join(directory, `${clientId}_${`${hash}`.toLowerCase()}.torrent`)
  }

  async function capture({
    clientId,
    hash,
    sourceDirectory,
    sourceFilename,
  }) {
    if (!hash) return ``
    const destination = filename(clientId, hash)

    try {
      await fileSystem.access(destination)
      return destination
    } catch {}

    if (!sourceDirectory) return ``

    const basenames = [
      sourceFilename && path.posix.basename(sourceFilename.replace(/\\/g, `/`)),
      `${hash}.torrent`,
    ].filter((value, index, all) => value && all.indexOf(value) === index)

    let lastError
    for (const basename of basenames) {
      const source = path.join(sourceDirectory, basename)
      try {
        await fileSystem.copyFile(source, destination)
        return destination
      } catch (error) {
        lastError = error
      }
    }

    logger?.error(
      `Failed to copy torrent metadata for ${clientId}:${hash} from "${sourceDirectory}"`,
      lastError
    )
    return ``
  }

  async function save({ clientId, hash, metainfo }) {
    if (!hash || !metainfo) return ``
    const destination = filename(clientId, hash)
    const data = Buffer.isBuffer(metainfo)
      ? metainfo
      : Buffer.from(metainfo, `base64`)
    await fileSystem.writeFile(destination, data)
    return destination
  }

  return { capture, filename, save }
}
