import assert from "assert"
import fs from "fs/promises"
import os from "os"
import path from "path"
import Transmission from "./index.js"
import Requester from "./Requester.js"
import { load as loadState } from "../../state.js"

describe(`Transmission connector`, () => {
  it(`normalizes snapshots and routes mutations with native ids`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), `gearbox-transmission-`))
    const calls = []
    const changes = []
    const scheduled = []
    const saved = []
    try {
      await loadState(path.join(root, `state.json`))
      const connector = await Transmission(
        {
          id: `transmissiontest`,
          type: `transmission`,
          url: `http://transmission:9091`,
          torrentDir: `/remote/torrents`,
        },
        {
          changes: (entry) => changes.push(entry),
          fetch: async (url, options) => {
            const request = JSON.parse(options.body)
            calls.push({ url, request })
            if (request.method === `torrent-get`) {
              if (request.arguments.ids === `recently-active`) {
                return response({ torrents: [], removed: [7] })
              }
              return response({
                torrents: [
                  {
                    id: 7,
                    hashString: `a`.repeat(40),
                    name: `Example`,
                    status: 4,
                    torrentFile: `/native/Example.hash.torrent`,
                  },
                ],
              })
            }
            if (request.method === `torrent-add`) {
              return response({
                "torrent-added": {
                  id: 8,
                  name: `Added`,
                  hashString: `b`.repeat(40),
                },
              })
            }
            return response({})
          },
          logger: { error() {} },
          now: () => 100000,
          reportStatus() {},
          schedule: (callback, delay) => scheduled.push({ callback, delay }),
          torrentStore: {
            async capture(args) {
              assert.equal(args.sourceFilename, `/native/Example.hash.torrent`)
              return `/gearbox/source.torrent`
            },
            async save(args) {
              saved.push(args)
              return `/gearbox/added.torrent`
            },
          },
        }
      )

      assert.equal(connector.type, `transmission`)
      assert.equal(connector.count(), 1)
      const torrent = [...connector.getAll()][0]
      assert.equal(torrent.localId, 7)
      assert.equal(torrent.clientType, `transmission`)
      assert.deepEqual(torrent.files, [])
      assert.equal(torrent.torrentFile, `/gearbox/source.torrent`)

      await connector.stopTorrents([7])
      assert.deepEqual(calls.at(-1).request.arguments.ids, [7])

      await connector.addTorrent({ metainfo: `dGVzdA==` })
      assert.equal(saved[0].hash, `b`.repeat(40))

      const poll = scheduled.find((entry) => entry.delay === 1000)
      await poll.callback()
      assert.equal(connector.count(), 0)
      assert(changes.some((entry) => entry.id === torrent.id && entry.isRemoved))
    } finally {
      await new Promise((resolve) => setImmediate(resolve))
      await fs.rm(root, { recursive: true })
    }
  })

  it(`does not send absent credentials and surfaces RPC errors`, async () => {
    let request
    const requester = Requester(`http://transmission:9091`, {
      logger: { debug() {}, error() {} },
      fetch: async (url, options) => {
        request = { url, options }
        return {
          ok: true,
          status: 200,
          async json() {
            return { result: `permission denied`, arguments: {} }
          },
        }
      },
    })

    await assert.rejects(
      requester(`torrent-get`, { fields: [`id`] }),
      /Transmission error: permission denied/
    )
    assert.equal(request.url, `http://transmission:9091/transmission/rpc`)
    assert.equal(`Authorization` in request.options.headers, false)
  })
})

function response(arguments_) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { result: `success`, arguments: arguments_ }
    },
  }
}
