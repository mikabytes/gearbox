import byClient from "../byClient.js"
import fields from "../clients/transmission/fields.js"

export default async function torrentGet(clients, args) {
  if (!args.fields || !Array.isArray(args.fields)) {
    throw new Error(`fields must be an array`)
  }

  for (const field of args.fields) {
    if (!fields.includes(field)) {
      throw new Error(`Invalid field: ${field}`)
    }
  }

  const torrents = []
  const split = byClient(clients, args.ids)

  for (const clientId of Object.keys(split)) {
    const ids = split[clientId]
    const client = clients.get(clientId)
    for (const id of ids) {
      const torrent = client.get(id)

      if (!torrent) {
        throw new Error(`Torrent '${id}' not found`)
      }

      torrents.push(torrent)
    }
  }

  let formattedTorrentArray

  if (args.format === `table`) {
    formattedTorrentArray = [args.fields]

    for (const torrent of torrents) {
      formattedTorrentArray.push(args.fields.map((field) => torrent[field]))
    }
  } else {
    formattedTorrentArray = torrents.map((torrent) => {
      const ret = {}
      for (const field of args.fields) {
        ret[field] = torrent[field]
      }
      return ret
    })
  }

  return {
    torrents: formattedTorrentArray,
  }
}
