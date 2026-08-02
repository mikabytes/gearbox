import assert from "assert"

import TorrentCache from "./TorrentCache.js"

describe(`TorrentCache`, () => {
  it(`normalizes, diffs, removes, and tracks recent torrents`, () => {
    let now = 1000
    const events = []
    const cache = TorrentCache({
      clientId: `one`,
      clientType: `fixture`,
      changes: (event) => events.push(event),
      globalId: (localId) => 100 + Number(localId),
      now: () => now,
    })

    const added = cache.upsert(2, { name: `First`, totalSize: 10 })
    assert.equal(added.id, 102)
    assert.equal(added.localId, 2)
    assert.equal(cache.count(), 1)
    assert.equal(events[0].changeSet.name, `First`)

    cache.upsert(2, { name: `Second` })
    assert.deepEqual(events[1], {
      id: 102,
      changeSet: { name: `Second` },
    })

    cache.remove(2)
    assert.deepEqual(events[2], { id: 102, isRemoved: true })
    assert.deepEqual([...cache.getRecent()], [{ id: 102, isRemoved: true }])

    now += 60001
    assert.deepEqual([...cache.getRecent()], [])
  })

  it(`reconciles complete snapshots`, () => {
    const cache = TorrentCache({
      clientId: `one`,
      clientType: `fixture`,
      globalId: (localId) => Number(localId),
    })

    cache.replaceAll([
      [`1`, { name: `One` }],
      [`2`, { name: `Two` }],
    ])
    cache.replaceAll([[`2`, { name: `Updated` }]])

    assert.equal(cache.count(), 1)
    assert.equal(cache.get(2).name, `Updated`)
  })

  it(`does not mark initial or unchanged snapshots as recent`, () => {
    const cache = TorrentCache({
      clientId: `one`,
      clientType: `fixture`,
      globalId: () => 1,
    })

    cache.replaceAll([[`a`, { name: `A` }]], { notify: false })
    assert.deepEqual([...cache.getRecent()], [])

    cache.replaceAll([[`a`, { name: `A` }]])
    assert.deepEqual([...cache.getRecent()], [])

    cache.replaceAll([[`a`, { name: `Changed` }]])
    assert.equal([...cache.getRecent()][0].name, `Changed`)
  })
})
