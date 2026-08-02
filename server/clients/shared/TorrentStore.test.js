import assert from "assert"
import fs from "fs/promises"
import os from "os"
import path from "path"
import TorrentStore from "./TorrentStore.js"

describe(`TorrentStore`, () => {
  it(`uses the backend-reported basename before the hash fallback`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), `gearbox-store-`))
    try {
      const source = path.join(root, `source`)
      await fs.mkdir(source)
      await fs.writeFile(path.join(source, `name.hash.torrent`), `metainfo`)
      const store = await TorrentStore({ workdir: root })

      const result = await store.capture({
        clientId: `one`,
        hash: `HASH`,
        sourceDirectory: source,
        sourceFilename: `/remote/name.hash.torrent`,
      })

      assert.equal(await fs.readFile(result, `utf8`), `metainfo`)
    } finally {
      await fs.rm(root, { recursive: true })
    }
  })

  it(`does not advertise metadata that does not exist`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), `gearbox-store-`))
    try {
      const store = await TorrentStore({ workdir: root })
      assert.equal(
        await store.capture({ clientId: `one`, hash: `missing` }),
        ``
      )
    } finally {
      await fs.rm(root, { recursive: true })
    }
  })
})
