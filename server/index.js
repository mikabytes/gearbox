import Connector from "./connector.js"
import start from "./server.js"
import * as guid from "./guid.js"

let cb
let initialized

const connectors = new Map()

await Promise.all([
  Connector({ id: `mam`, ip: "10.0.100.14", port: 80, changes }),
  Connector({ id: `sofa`, ip: "10.0.100.21", port: 80, changes }),
  Connector({ id: `pam`, ip: "10.0.107.1", port: 80, changes }),
  Connector({ id: `pt`, ip: "10.0.100.68", port: 80, changes }),
  Connector({ id: `transm`, ip: "10.0.100.8", port: 80, changes }),
]).then((_) => {
  for (let connector of _) {
    connectors.set(connector.id, connector)
  }
})

initialized = true

function changes(entry) {
  if (!initialized) {
    return
  }

  cb?.(entry)

  const { id, changeSet, isRemoved } = entry
}

start({
  stream(newCb) {
    cb = newCb
  },
  *getAll() {
    for (let c of connectors.values()) {
      yield* c.getAll()
    }
  },
  async request(args) {
    try {
      const split = byClient(args.ids)
      for (const clientId of Object.keys(split)) {
        const resultArgs = await connectors
          .get(clientId)
          .request(`torrent-remove`, {
            ids: split[clientId],
            "delete-local-data": args[`delete-local-data`],
          })

        if (!resultArgs.result === `success`) {
          throw new Error(`${clientId} returned an error: ${resultArgs.result}`)
        }
      }

      return [null, { result: `success` }]
    } catch (e) {
      console.error(e)
      return [e]
    }
  },
})

function byClient(ids) {
  let byClient = {}

  for (let id of ids) {
    const { clientId, torrentId } = guid.decode(id)
    byClient[clientId] ||= []
    byClient[clientId].push(torrentId)
  }
  console.log(byClient)
  return byClient
}
