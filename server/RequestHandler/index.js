import torrentGet from "./torrentGet.js"
import torrentAdd from "./torrentAdd.js"
import generic from "./generic.js"
import sessionSet from "./sessionSet.js"
import sessionGet from "./sessionGet.js"

const mapper = {
  "torrent-get": torrentGet,
  "torrent-add": torrentAdd,
  "torrent-remove": generic,
  "torrent-set": generic,
  "torrent-set-location": generic,
  "torrent-start": generic,
  "torrent-start-now": generic,
  "torrent-start-stop": generic,
  "torrent-start-verify": generic,
  "torrent-reannounce": generic,
  "torrent-set": generic,
  "torrent-rename-path": generic,
  "session-set": sessionSet,
  "session-get": sessionGet,
}

export default function RequestHandler({ clients, config }) {
  async function request(method, args = {}) {
    if (mapper[method]) {
      return mapper[method](clients, args, method)
    } else {
      throw new Error(`Invalid method: ${method}`)
    }
  }

  return request
}
