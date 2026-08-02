import fields from "../clients/fields.js"
import logger from "../logger.js"
import lookup from "../lookup.js"

export default async function torrentGet(clients, args) {
  if (!args.fields || !Array.isArray(args.fields)) {
    throw new Error(`fields must be an array`)
  }

  const requestedFields = args.fields.filter((field) => {
    if (!fields.includes(field)) {
      logger.debug(
        `An invalid field "${field}" was requested, it will be ignored`
      )
      return false
    }
    return true
  })

  // iterator avoids creating an intermediary array
  const all = (function* () {
    for (const [client, torrents] of lookup(clients, args.ids)) {
      yield* torrents
    }
  })()

  let formattedTorrentArray

  if (args.format === `table`) {
    formattedTorrentArray = [requestedFields]

    for (const torrent of all) {
      formattedTorrentArray.push(
        requestedFields.map((field) => torrent[field])
      )
    }
  } else {
    formattedTorrentArray = [
      ...all.map((torrent) => {
        const ret = {}
        for (const field of requestedFields) {
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
