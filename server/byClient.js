import { decode } from "./guid.js"

export default function byClient(clients, ids) {
  let byClient = {}

  if (!ids) {
    // if ids is omitted, then this means all ids should be used
    for (const clientId of clients.keys()) {
      byClient[clientId] = [
        ...clients
          .get(clientId)
          .getAll()
          .map((t) => t.id),
      ]
    }
    return byClient
  }

  if (!Array.isArray(ids)) {
    if (isId(ids)) {
      ids = [ids]
    } else {
      throw new Error(`ids must be an array, or omitted`)
    }
  }

  // At this point ids is definitely a list of either id or hash
  outer: for (const id of ids) {
    if (isId(id)) {
      const { clientId, torrentId } = decode(id)
      byClient[clientId] ||= []
      byClient[clientId].push(id)
    } else if (isSHA1Hash(id)) {
      // inefficient, but using hash is a rare operation
      for (const client of clients.values()) {
        for (const torrent of client.getAll()) {
          if (torrent.hashString === id) {
            byClient[client.id] ||= []
            byClient[client.id].push(torrent.id)
            continue outer
          }
        }
      }
      throw new Error(`Torrent with hash ${id} not found`)
    } else {
      throw new Error(`Invalid id: ${JSON.stringify(id)}`)
    }
  }
  return byClient
}

function isId(thing) {
  const isNumber = typeof thing === "number"
  const isInteger = Number.isInteger(thing)
  const isPositive = thing > 0

  return isNumber && isInteger && isPositive
}

function isSHA1Hash(value) {
  return /^[a-f0-9]{40}$/i.test(value)
}
