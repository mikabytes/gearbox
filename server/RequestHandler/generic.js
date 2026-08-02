import lookup from "../lookup.js"

export default async function generic(clients, args, method) {
  const ret = {}
  const operation = operations[method]
  if (!operation) throw new Error(`No connector operation for ${method}`)
  const { ids: ignoredIds, ...operationArgs } = args

  for (const [client, torrents] of lookup(clients, args.ids)) {
    if (client.available === false) {
      if (args.ids === undefined) continue
      throw new Error(`Client ${client.id} is not available`)
    }
    if (!client.capabilities[operation.method]) {
      throw new Error(
        `Client ${client.id} (${client.type}) does not support ${method}`
      )
    }

    const localIds = [...torrents]
      .filter(Boolean)
      .map((torrent) => torrent.localId)
    if (!localIds.length) continue

    const resultArgs = await client[operation.method](localIds, {
      ...operationArgs,
      ...operation.arguments,
    })

    Object.assign(ret, resultArgs || {})
  }

  return ret
}

const operations = {
  "torrent-remove": { method: `removeTorrents` },
  "torrent-set": { method: `setTorrents` },
  "torrent-set-location": { method: `setLocation` },
  "torrent-start": { method: `startTorrents` },
  "torrent-start-now": { method: `startTorrentsNow` },
  "torrent-stop": { method: `stopTorrents` },
  "torrent-verify": { method: `verifyTorrents` },
  "torrent-reannounce": { method: `reannounceTorrents` },
  "torrent-rename-path": { method: `renameTorrentPath` },
  "queue-move-top": {
    method: `moveQueue`,
    arguments: { direction: `top` },
  },
  "queue-move-up": {
    method: `moveQueue`,
    arguments: { direction: `up` },
  },
  "queue-move-down": {
    method: `moveQueue`,
    arguments: { direction: `down` },
  },
  "queue-move-bottom": {
    method: `moveQueue`,
    arguments: { direction: `bottom` },
  },
}
