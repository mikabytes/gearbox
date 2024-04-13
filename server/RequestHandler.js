import * as guid from "./guid.js"

export default function RequestHandler({ connectors }) {
  async function passthrough(method, args) {
    const split = byClient(args.ids)
    for (const clientId of Object.keys(split)) {
      const resultArgs = await connectors.get(clientId).request(method, {
        ...args,
        ids: split[clientId],
      })

      console.log()
      console.log(`Request to ${clientId}: ${method} ${JSON.stringify(args)}`)
      console.log(`Response: ${JSON.stringify(resultArgs)}`)
      console.log()

      if (resultArgs.result !== `success`) {
        throw new Error(`${clientId} returned an error: ${resultArgs.result}`)
      }
    }

    return { result: `success` }
  }

  async function torrentAdd(args) {}

  async function request(method, args) {
    try {
      let ret
      if (Array.isArray(args.ids)) {
        // any calls that pass the ids array should be split by id and
        // passed through
        ret = await passthrough(method, args)
      } else if (method === `torrent-add`) {
        ret = await torrentAdd(args)
      }

      return [null, ret]
    } catch (e) {
      console.error(e)
      return [e]
    }
  }

  return request
}

function byClient(ids) {
  let byClient = {}

  for (let id of ids) {
    const { clientId, torrentId } = guid.decode(id)
    byClient[clientId] ||= []
    byClient[clientId].push(torrentId)
  }
  return byClient
}
