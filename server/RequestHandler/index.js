import generic from "./generic.js"
import logger from "../logger.js"
import sessionGet from "./sessionGet.js"
import sessionSet from "./sessionSet.js"
import torrentAdd from "./torrentAdd.js"
import torrentGet from "./torrentGet.js"

const mapper = {
  "torrent-get": torrentGet,
  "torrent-add": torrentAdd,
  "torrent-remove": generic,
  "torrent-set": generic,
  "torrent-set-location": generic,
  "torrent-start": generic,
  "torrent-start-now": generic,
  "torrent-stop": generic,
  "torrent-verify": generic,
  "torrent-reannounce": generic,
  "torrent-set": generic,
  "torrent-rename-path": generic,
  "session-set": sessionSet,
  "session-get": sessionGet,
  "queue-move-top": generic,
  "queue-move-up": generic,
  "queue-move-down": generic,
  "queue-move-bottom": generic,
}

export default function RequestHandler({ clients, config }) {
  async function request(method, args = {}) {
    if (mapper[method]) {
      const ret = await mapper[method](clients, args, method)
      return ret
    } else {
      throw new Error(`Invalid method: ${method}`)
    }
  }

  return request
}
