import assert from "assert"
import fs from "fs/promises"
import os from "os"
import path from "path"

import IdAllocator from "./IdAllocator.js"

describe(`IdAllocator`, () => {
  let directory
  let filename

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), `gearbox-ids-`))
    filename = path.join(directory, `torrent-ids.json`)
  })

  afterEach(async () => {
    await fs.rm(directory, { recursive: true })
  })

  it(`persists stable per-client ids`, async () => {
    const first = await IdAllocator({ filename, writeDelay: 10000 })
    assert.equal(first.allocate(`one`, `ABC`), 1)
    assert.equal(first.allocate(`one`, `def`), 2)
    assert.equal(first.allocate(`two`, `abc`), 1)
    await first.flush()

    const second = await IdAllocator({ filename, writeDelay: 10000 })
    assert.equal(second.allocate(`one`, `abc`), 1)
    assert.equal(second.allocate(`one`, `new`), 3)
    await second.flush()
  })
})

