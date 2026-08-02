import fs from "fs/promises"
import path from "path"

const MAX_LOCAL_ID = 4194303

export default async function IdAllocator({
  filename,
  logger,
  writeDelay = 100,
  fileSystem = fs,
}) {
  const data = { version: 1, clients: {} }
  let timer
  let writing
  let dirty = false

  try {
    const stored = JSON.parse(await fileSystem.readFile(filename, `utf8`))
    if (stored?.version === 1 && stored.clients) {
      Object.assign(data.clients, stored.clients)
    }
  } catch (error) {
    if (error.code !== `ENOENT`) throw error
  }

  function allocate(clientId, nativeId) {
    nativeId = `${nativeId}`.toLowerCase()
    const client = (data.clients[clientId] ||= { next: 1, ids: {} })
    if (client.ids[nativeId]) return client.ids[nativeId]

    if (client.next > MAX_LOCAL_ID) {
      throw new Error(`Connector "${clientId}" exhausted its torrent id space`)
    }

    const id = client.next++
    client.ids[nativeId] = id
    changed()
    return id
  }

  function changed() {
    dirty = true
    if (!timer) {
      timer = setTimeout(() => {
        flush().catch((error) => logger?.error(error))
      }, writeDelay)
    }
  }

  async function flush() {
    clearTimeout(timer)
    timer = undefined
    if (writing) await writing
    if (!dirty) return

    dirty = false
    const temporary = `${filename}.tmp`
    writing = (async () => {
      await fileSystem.mkdir(path.dirname(filename), { recursive: true })
      await fileSystem.writeFile(temporary, JSON.stringify(data))
      await fileSystem.rename(temporary, filename)
    })()

    try {
      await writing
    } catch (error) {
      dirty = true
      logger?.error(`Failed to persist torrent id mappings`, error)
      throw error
    } finally {
      writing = undefined
    }
  }

  return { allocate, flush }
}
