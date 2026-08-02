import assert from "assert"
import torrentAdd from "./torrentAdd.js"
import { capabilities } from "../clients/contract.js"

describe(`torrent-add request handling`, () => {
  it(`routes a specific request through the connector boundary`, async () => {
    let received
    const client = {
      id: `one`,
      capabilities: capabilities({ addTorrent: true }),
      async addTorrent(args) {
        received = args
        return { "torrent-added": { id: 1 } }
      },
    }
    const args = { clientId: `one`, metainfo: `base64` }

    const result = await torrentAdd(new Map([[client.id, client]]), args)

    assert.deepEqual(received, { metainfo: `base64` })
    assert.deepEqual(result, { "torrent-added": { id: 1 } })
  })

  it(`rejects a specific connector that is offline`, async () => {
    const client = {
      id: `one`,
      available: false,
      capabilities: capabilities({ addTorrent: true }),
      async addTorrent() {
        assert.fail(`offline connector should not be called`)
      },
    }

    await assert.rejects(
      torrentAdd(new Map([[client.id, client]]), {
        clientId: `one`,
        metainfo: `base64`,
      }),
      /Client one is not available/
    )
  })
})
