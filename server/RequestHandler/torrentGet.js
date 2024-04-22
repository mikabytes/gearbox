import fields from "../clients/transmission/fields.js"
import logger from "../logger.js"
import lookup from "../lookup.js"

export default async function torrentGet(clients, args) {
  if (!args.fields || !Array.isArray(args.fields)) {
    throw new Error(`fields must be an array`)
  }

  for (const field of args.fields) {
    if (!fields.includes(field)) {
      logger.debug(
        `An invalid field "${field}" was requested, it will be ignored`
      )

      // remove it from fields
      args.fields.splice(args.fields.indexOf(field), 1)
    }
  }

  // iterator avoids creating an intermediary array
  const all = (function* () {
    for (const [client, torrents] of lookup(clients, args.ids)) {
      yield* torrents
    }
  })()

  let formattedTorrentArray

  if (args.format === `table`) {
    formattedTorrentArray = [args.fields]

    for (const torrent of all) {
      formattedTorrentArray.push(args.fields.map((field) => torrent[field]))
    }
  } else {
    formattedTorrentArray = [
      ...all.map((torrent) => {
        const ret = {}
        for (const field of args.fields) {
          ret[field] = torrent[field]
        }
        return ret
      }),
    ]
  }

  return {
    torrents: formattedTorrentArray,
  }
}
