import fs from "fs/promises"
import path from "path"
import getConfig from "../config.js"
let incr = 0

export default async function torrentAdd(clients, args) {
  // torrentFile is a local (to gearbox) torrent file. We'll convert it to metainfo,
  // This handles the case when the remote client is not on the same machine as the local client
  if (args.torrentFile) {
    if (args.metainfo) {
      throw new Error(`Can't specify both 'torrentFile' and 'metainfo'!`)
    }

    const torrentFilePath = path.resolve(args.torrentFile)

    let exists
    try {
      exists = await fs.stat(torrentFilePath)
    } catch (e) {
      exists = false
    }

    if (exists) {
      const torrentFileData = await fs.readFile(torrentFilePath)
      args.metainfo = Buffer.from(torrentFileData).toString(`base64`)
      delete args.torrentFile
    } else {
      throw new Error(`File ${args.torrentFile} does not exist`)
    }

    delete args.torrentFile
  }

  // if client requested a specific client, then let's use that
  // args.clientId is an extension of Transmission RPC
  const specificClientId = args.clientId
  delete args.clientId

  if (specificClientId) {
    if (clients.has(specificClientId)) {
      return await clients.get(specificClientId).request(`torrent-add`, args)
    } else {
      throw new Error(`Client ${specificClientId} not found`)
    }
  }

  const config = getConfig()

  let available = [...clients.values()].filter((c) => {
    const clientConfig = config.clients.find((client) => client.id === c.id)
    const maxCount = clientConfig.maxCount

    return maxCount === -1 || c.count() < maxCount
  })

  if (!available.length) {
    throw new Error(`No suitable clients available`)
  }

  const strategy = config.addTorrentStrategy
  let client
  if (strategy === `least-count`) {
    client = available.sort((a, b) => a.count() - b.count())[0]
  } else if (strategy === `round-robin`) {
    client = available[incr++ % available.length]
  } else if (strategy === `first-found`) {
    client = available[0]
  } else {
    throw new Error(`Strategy ${strategy} not implemented.`)
  }

  const response = await client.request(`torrent-add`, args)

  if (response.result !== `success`) {
    throw new Error(`Failed to add torrent: ${response.result}`)
  }

  return response.arguments
}
