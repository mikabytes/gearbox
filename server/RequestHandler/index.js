import torrentGet from "./torrentGet.js"
import torrentAdd from "./torrentAdd.js"
import torrentRemove from "./torrentRemove.js"
import torrentSet from "./torrentSet.js"
import torrentSetLocation from "./torrentSetLocation.js"
import genericIds from "./genericIds.js"

export default function RequestHandler({ clients, config }) {
  async function request(method, args) {
    if (method === `torrent-get`) {
      return await torrentGet(clients, args)
    } else if (method === `torrent-remove`) {
      return await torrentRemove(clients, args)
    } else if (method === `torrent-set`) {
      return await torrentSet(clients, args)
    } else if (method === `torrent-set-location`) {
      return await torrentSetLocation(clients, args)
    } else if (Array.isArray(args.ids)) {
      return await genericIds(clients, method, args)
    } else if (method === `torrent-add`) {
      return await torrentAdd(clients, args)
    }
  }

  return request
}
