import Connector from "./connector.js"
import start from "./server.js"

let cb
let initialized

const connectors = new Map()

await Promise.all([
  Connector({ id: `mam`, ip: "10.0.100.14", port: 80, changes }),
  Connector({ id: `sofa`, ip: "10.0.100.21", port: 80, changes }),
  Connector({ id: `pam`, ip: "10.0.107.1", port: 80, changes }),
  Connector({ id: `pt`, ip: "10.0.100.68", port: 80, changes }),
  Connector({ id: `transmission`, ip: "10.0.100.8", port: 80, changes }),
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

  console.log(id, isRemoved || entry)
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
})
