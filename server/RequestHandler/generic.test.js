import assert from "assert"
import generic from "./generic.js"
import { capabilities } from "../clients/contract.js"

const hash = `0123456789abcdef0123456789abcdef01234567`

describe(`generic request handling`, () => {
  it(`dispatches normalized operations with backend-native ids`, async () => {
    let call
    const torrent = { id: 123, localId: `native-id`, hashString: hash }
    const client = {
      id: `fake`,
      type: `fake`,
      capabilities: capabilities({ moveQueue: true }),
      getAll: () => [torrent],
      async moveQueue(ids, args) {
        call = { ids, args }
        return { moved: true }
      },
    }

    const result = await generic(
      new Map([[client.id, client]]),
      { ids: [hash] },
      `queue-move-bottom`
    )

    assert.deepEqual(call.ids, [`native-id`])
    assert.equal(call.args.direction, `bottom`)
    assert.equal(`ids` in call.args, false)
    assert.deepEqual(result, { moved: true })
  })

  it(`rejects operations the connector does not support`, async () => {
    const torrent = { id: 123, localId: `native-id`, hashString: hash }
    const client = {
      id: `fake`,
      type: `fake`,
      capabilities: capabilities(),
      getAll: () => [torrent],
    }

    await assert.rejects(
      generic(
        new Map([[client.id, client]]),
        { ids: [hash] },
        `torrent-verify`
      ),
      /does not support torrent-verify/
    )
  })

  it(`skips an unavailable connector only for all-torrent operations`, async () => {
    const torrent = { id: 123, localId: `native-id`, hashString: hash }
    const client = {
      id: `fake`,
      type: `fake`,
      available: false,
      capabilities: capabilities({ verifyTorrents: true }),
      getAll: () => [torrent],
      async verifyTorrents() {
        assert.fail(`offline connector should not be called`)
      },
    }
    const clients = new Map([[client.id, client]])

    assert.deepEqual(await generic(clients, {}, `torrent-verify`), {})
    await assert.rejects(
      generic(clients, { ids: [hash] }, `torrent-verify`),
      /Client fake is not available/
    )
  })
})
