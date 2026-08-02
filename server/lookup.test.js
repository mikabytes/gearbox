import assert from "assert"
import lookup from "./lookup.js"

describe(`lookup`, () => {
  it(`matches v1 and v2 hashes without case sensitivity`, () => {
    const hashes = [
      `0123456789abcdef0123456789abcdef01234567`,
      `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`,
    ]
    const torrents = hashes.map((hash, index) => ({
      id: index + 1,
      hashString: hash,
    }))
    const client = {
      id: `one`,
      getAll: () => torrents,
    }

    for (const hash of hashes) {
      const results = [
        ...lookup(new Map([[client.id, client]]), hash.toUpperCase()),
      ]
      assert.deepEqual([...results[0][1]], [
        torrents.find((torrent) => torrent.hashString === hash),
      ])
    }
  })
})
