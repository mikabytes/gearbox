import * as guid from "./guid.js"

export default function RequestHandler({ connectors, config }) {
  let incr = 0

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

  async function torrentAdd(args) {
    // if client requested a specific client, then let's use that
    // args.clientId is an extension of Transmission RPC
    if (args.clientId) {
      if (connectors.has(args.clientId)) {
        return await connectors.get(args.clientId).request(`torrent-add`, args)
      } else {
        throw new Error(`Client ${args.clientId} not found`)
      }
    }

    let available = connectors
      .values()
      .filter((c) => c.count() < strategy.addTorrents.maxCount)

    if (!available.length) {
      throw new Error(`No suitable clients available`)
    }

    const strategy = config.addTorrentStrategy
    let client
    if (strategy === `least-count`) {
      client = available.sort((a, b) => a.count() - b.count())[0]
    } else if (strategy === `round-robin`) {
      client = available[incr++ % available.length]
    } else if (strategy === `first-found`) {
      client = available[0]
    } else {
      throw new Error(`Strategy ${strategy} not implemented.`)
    }

    return await client.request(`torrent-add`, args)
  }

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
