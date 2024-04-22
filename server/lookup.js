import { decode } from "./guid.js"
import { isId, isSHA1Hash } from "./validators.js"
import logger from './logger.js'

// returns an iterator over clients, which in turn returns an iterator over their torrents matching the ids
//
// ids can be an array of ids, an array of hashes, an integer, or "recently-active"
export default function* lookup(clients, ids) {
  for (const client of clients.values()) {
    const iterator = getTorrents(client, ids)

    // Only yield client if it has at least one item
    const first = iterator.next()

    if (!first.done) {
      yield [
        client,
        (function* () {
          yield first.value
          yield* iterator
        })(),
      ]
    }
  }
}

function* getTorrents(client, ids) {
  if (!ids) {
    // if ids is omitted, then this means all ids should be used
    yield* client.getAll()
    return
  } else if (ids === `recently-active`) {
    yield* client.getRecent()
    return
  }

  if (!Array.isArray(ids)) {
    if (isId(ids)) {
      ids = [ids]
    } else {
      throw new Error(`ids must be an array, "recently-active", or omitted`)
    }
  }

  // At this point ids is definitely a list of either id or hash
  outer: for (const id of ids) {
    if (isId(id)) {
      const { clientId, torrentId } = decode(id)

      if (clientId !== client.id) {
        continue
      }
      yield client.get(id)
    } else if (isSHA1Hash(id)) {
      // inefficient, but using hash is a rare operation
      for (const torrent of client.getAll()) {
        if (torrent.hashString === id) {
          yield torrent
          continue outer
        }
      }
    } else {
      throw new Error(`Invalid id: ${JSON.stringify(id)}`)
    }
  }
}
