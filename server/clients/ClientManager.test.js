import assert from "assert"
import ClientManager from "./ClientManager.js"
import { capabilities } from "./contract.js"

describe(`ClientManager`, () => {
  it(`keeps an offline connector's cache while marking it unavailable`, async () => {
    let reportStatus
    const connector = {
      id: `one`,
      type: `fake`,
      capabilities: capabilities(),
      count: () => 1,
      get: () => ({ id: 1 }),
      getAll: () => [{ id: 1 }],
      getRecent: () => ({ torrents: [], removed: [] }),
    }
    const manager = ClientManager({
      clientConfigs: [{ id: `one`, type: `fake` }],
      implementations: {
        async fake(config, dependencies) {
          reportStatus = dependencies.reportStatus
          return connector
        },
      },
      dependencies: {},
      logger: { error() {} },
    })

    const clients = await manager.start()
    reportStatus(`offline`, `connection lost`)

    assert.equal(clients.get(`one`), connector)
    assert.equal(connector.available, false)
    assert.deepEqual(manager.publicClients()[0], {
      id: `one`,
      type: `fake`,
      maxCount: undefined,
      state: `offline`,
      error: `connection lost`,
      capabilities: connector.capabilities,
    })

    reportStatus(`online`)
    assert.equal(connector.available, true)
  })

  it(`announces torrents when an initially offline connector recovers`, async () => {
    let attempt = 0
    let retry
    const changes = []
    const torrent = { id: 7, name: `Recovered` }
    const connector = {
      id: `one`,
      type: `fake`,
      capabilities: capabilities(),
      count: () => 1,
      get: () => torrent,
      getAll: () => [torrent],
      getRecent: () => [][Symbol.iterator](),
    }
    const manager = ClientManager({
      clientConfigs: [{ id: `one`, type: `fake` }],
      implementations: {
        async fake() {
          if (!attempt++) throw new Error(`offline`)
          return connector
        },
      },
      dependencies: { changes: (entry) => changes.push(entry) },
      logger: { error() {} },
      schedule(callback) {
        retry = callback
      },
    })

    const clients = await manager.start()
    assert.equal(clients.size, 0)
    await retry()

    assert.equal(clients.get(`one`), connector)
    assert.deepEqual(changes, [{ id: 7, changeSet: torrent }])
  })
})
