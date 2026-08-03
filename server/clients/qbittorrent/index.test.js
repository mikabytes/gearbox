import assert from "assert"

import Qbittorrent from "./index.js"
import { metainfoHashes } from "./metainfo.js"

const HASH_A = `a`.repeat(40)
const HASH_B = `b`.repeat(64)

describe(`qBittorrent connector`, () => {
  it(`authenticates with exact CSRF headers and maps a UI-safe torrent`, async () => {
    const fixture = mockQbittorrent({
      sync: [
        fullSync({
          [HASH_A]: torrentFixture({
            hash: HASH_A,
            state: `stalledDL`,
            category: `sonarr`,
            tags: `tv, linux`,
            progress: 0.25,
            ratio: 1.5,
            tracker: `udp://tracker.example:80/announce`,
          }),
        }),
      ],
    })
    const connector = await makeConnector(fixture)
    const torrent = [...connector.getAll()][0]

    assert.equal(connector.type, `qbittorrent`)
    assert.equal(torrent.localId, HASH_A)
    assert.equal(torrent.hashString, HASH_A)
    assert.equal(torrent.status, 4)
    assert.equal(torrent.isStalled, true)
    assert.equal(torrent.percentDone, 0.25)
    assert.equal(torrent.group, `sonarr`)
    assert.deepEqual(torrent.labels, [`tv`, `linux`, `sonarr`])
    assert.equal(torrent.trackers[0].sitename, `tracker.example`)
    assert.deepEqual(torrent.files, [])
    assert.deepEqual(torrent.trackerStats[0].seederCount, 12)
    assert.equal(torrent.trackerStats[0].lastScrapeTimedOut, false)

    for (const call of fixture.calls) {
      assert.equal(call.options.headers.Origin, `http://qbt.test:8080`)
      assert.equal(call.options.headers.Referer, `http://qbt.test:8080`)
    }
    const syncCall = fixture.calls.find((call) => call.url.pathname.endsWith(`/sync/maindata`))
    assert.equal(syncCall.options.headers.Cookie, `SID=test-session`)
  })

  it(`re-authenticates once when the session expires`, async () => {
    let rejected = false
    const fixture = mockQbittorrent({
      sync: [fullSync({})],
      route(call) {
        if (call.url.pathname.endsWith(`/app/version`) && !rejected) {
          rejected = true
          return response(`Forbidden`, { status: 403 })
        }
      },
    })

    await makeConnector(fixture)
    assert.equal(
      fixture.calls.filter((call) => call.url.pathname.endsWith(`/auth/login`)).length,
      2
    )
  })

  it(`applies incremental deltas and removals`, async () => {
    const scheduled = []
    const events = []
    const fixture = mockQbittorrent({
      sync: [
        fullSync({
          [HASH_A]: torrentFixture({ hash: HASH_A, state: `downloading` }),
          [HASH_B]: torrentFixture({ hash: HASH_B, state: `uploading` }),
        }),
        {
          rid: 2,
          full_update: false,
          torrents: { [HASH_A]: { state: `pausedDL`, dlspeed: 0 } },
          torrents_removed: [HASH_B],
        },
      ],
    })
    const connector = await makeConnector(fixture, {
      changes: (event) => events.push(event),
      schedule: (fn, delay) => scheduled.push({ fn, delay }),
    })

    const poll = scheduled.find((entry) => entry.delay === 1000)
    await poll.fn()

    assert.equal(connector.count(), 1)
    assert.equal([...connector.getAll()][0].status, 0)
    assert(events.some((event) => event.isRemoved), `expected a removal event`)
    assert(
      events.some((event) => event.changeSet?.status === 0),
      `expected a stopped status delta`
    )
    const recent = [...connector.getRecent()]
    assert(recent.some((torrent) => torrent.isRemoved), `expected recent removal`)
  })

  it(`uses pause/resume aliases only for qBittorrent 4.5/4.6`, async () => {
    const fixture = mockQbittorrent({ version: `v4.6.7`, sync: [fullSync({})] })
    const connector = await makeConnector(fixture)

    await connector.startTorrents([HASH_A])
    await connector.stopTorrents([HASH_A])

    const paths = fixture.calls.map((call) => call.url.pathname)
    assert(paths.some((value) => value.endsWith(`/torrents/resume`)))
    assert(paths.some((value) => value.endsWith(`/torrents/pause`)))
    assert(!paths.some((value) => value.endsWith(`/torrents/start`)))
    assert(!paths.some((value) => value.endsWith(`/torrents/stop`)))
  })

  it(`translates current mutations and rejects unsupported torrent-set fields`, async () => {
    const fixture = mockQbittorrent({
      sync: [fullSync({ [HASH_A]: torrentFixture({ hash: HASH_A }) })],
      defaultSavePath: `/downloads`,
      trackers: [
        { url: `udp://one.example/announce`, tier: 0, status: 2 },
        { url: `udp://two.example/announce`, tier: 1, status: 2 },
      ],
    })
    const connector = await makeConnector(fixture)

    await connector.setLocation([HASH_A], { location: `/new`, move: true })
    await connector.startTorrentsNow([HASH_A])
    await connector.verifyTorrents([HASH_A])
    await connector.reannounceTorrents([HASH_A])
    await connector.moveQueue([HASH_A], { direction: `top` })
    await connector.setTorrents([HASH_A], {
      ids: [123],
      downloadLimit: 5,
      downloadLimited: true,
      labels: [`tv`],
      honorsSessionLimits: true,
    })
    await connector.setTorrents([HASH_A], {
      trackerAdd: [`udp://three.example/announce`],
      trackerRemove: [0],
      trackerReplace: [1, `udp://changed.example/announce`],
    })
    const renamed = await connector.renameTorrentPath([HASH_A], {
      path: `example`,
      name: `renamed`,
    })
    const session = await connector.sessionGet()
    await connector.removeTorrents([HASH_A], { "delete-local-data": true })

    assert.deepEqual(renamed, { path: `example`, name: `renamed` })
    assert.equal(session[`download-dir`], `/downloads`)
    const downloadLimit = fixture.calls.find((call) =>
      call.url.pathname.endsWith(`/torrents/setDownloadLimit`)
    )
    assert.equal(form(downloadLimit).get(`limit`), `5000`)
    const removal = fixture.calls.find((call) =>
      call.url.pathname.endsWith(`/torrents/delete`)
    )
    assert.equal(form(removal).get(`deleteFiles`), `true`)
    assert(
      fixture.calls.some((call) => call.url.pathname.endsWith(`/torrents/rename`))
    )
    const removeTracker = fixture.calls.find((call) =>
      call.url.pathname.endsWith(`/torrents/removeTrackers`)
    )
    assert.equal(form(removeTracker).get(`urls`), `udp://one.example/announce`)
    const replaceTracker = fixture.calls.find((call) =>
      call.url.pathname.endsWith(`/torrents/editTracker`)
    )
    assert.equal(form(replaceTracker).get(`origUrl`), `udp://two.example/announce`)
    assert.equal(form(replaceTracker).get(`newUrl`), `udp://changed.example/announce`)
    await assert.rejects(
      connector.setTorrents([HASH_A], { queuePosition: 3 }),
      /does not support torrent-set argument.*queuePosition/
    )
  })

  it(`adds metainfo and applies filesWanted as a safe second phase`, async () => {
    const metainfo = Buffer.from(
      `d4:infod6:lengthi2e4:name4:test12:piece lengthi16384e6:pieces20:abcdefghijklmnopqrstee`
    ).toString(`base64`)
    const hash = metainfoHashes(metainfo)[0]
    const saved = []
    const fixture = mockQbittorrent({
      sync: [fullSync({})],
      info: [torrentFixture({ hash, name: `test`, total_size: 2, size: 2 })],
      files: [
        { index: 0, name: `one`, size: 1, progress: 0, priority: 1 },
        { index: 1, name: `two`, size: 1, progress: 0, priority: 1 },
      ],
    })
    const connector = await makeConnector(fixture, {
      torrentStore: {
        async save(value) {
          saved.push(value)
          return `/store/${value.hash}.torrent`
        },
      },
    })

    const result = await connector.addTorrent({ metainfo, filesWanted: [1] })

    assert.equal(result[`torrent-added`].hashString, hash)
    assert.equal(saved[0].hash, hash)
    const add = fixture.calls.find((call) => call.url.pathname.endsWith(`/torrents/add`))
    assert(add.options.body instanceof FormData)
    assert(add.options.body.get(`torrents`) instanceof Blob)
    assert.equal(add.options.body.get(`stopped`), `true`)
    const priorityCalls = fixture.calls.filter((call) =>
      call.url.pathname.endsWith(`/torrents/filePrio`)
    )
    assert.equal(priorityCalls.length, 2)
    assert.equal(form(priorityCalls[0]).get(`id`), `0`)
    assert.equal(form(priorityCalls[0]).get(`priority`), `0`)
    assert.equal(form(priorityCalls[1]).get(`id`), `1`)
    assert.equal(form(priorityCalls[1]).get(`priority`), `1`)
    assert(
      fixture.calls.some((call) => call.url.pathname.endsWith(`/torrents/start`))
    )
  })

  it(`backs off when configured torrent metainfo is unavailable`, async () => {
    const scheduled = []
    let captures = 0
    const fixture = mockQbittorrent({
      sync: [
        fullSync({ [HASH_A]: torrentFixture({ hash: HASH_A }) }),
        {
          rid: 2,
          full_update: false,
          torrents: { [HASH_A]: { dlspeed: 20 } },
        },
      ],
    })
    await Qbittorrent(
      { id: `qbt`, url: `http://qbt.test:8080`, torrentDir: `/missing` },
      {
        fetch: fixture.fetch,
        logger: { debug() {}, error() {} },
        now: () => 100000,
        schedule: (fn, delay) => scheduled.push({ fn, delay }),
        reportStatus() {},
        globalId: () => 1,
        torrentStore: {
          async capture() {
            captures++
            return ``
          },
        },
      }
    )

    scheduled.find((entry) => entry.delay === 0).fn()
    await new Promise((resolve) => setImmediate(resolve))
    await scheduled.find((entry) => entry.delay === 1000).fn()

    assert.equal(captures, 1)
    assert.equal(
      scheduled.filter((entry) => entry.delay === 0).length,
      1,
      `sync delta should not immediately requeue failed capture`
    )
  })

  it(`downloads HTTP torrent URLs before adding them`, async () => {
    const metainfo = Buffer.from(
      `d4:infod6:lengthi2e4:name4:test12:piece lengthi16384e6:pieces20:abcdefghijklmnopqrstee`
    )
    const hash = metainfoHashes(metainfo)[0]
    let remoteRequest
    const fixture = mockQbittorrent({
      sync: [fullSync({})],
      info: [torrentFixture({ hash, name: `test` })],
      route(call) {
        if (call.url.href === `https://example.test/file.torrent`) {
          remoteRequest = call
          return new Response(metainfo)
        }
      },
    })
    const connector = await makeConnector(fixture)

    const result = await connector.addTorrent({
      filename: `https://example.test/file.torrent`,
      cookies: `session=one`,
    })

    assert.equal(result[`torrent-added`].hashString, hash)
    assert.equal(remoteRequest.options.headers.Cookie, `session=one`)
    const add = fixture.calls.find((call) =>
      call.url.pathname.endsWith(`/torrents/add`)
    )
    assert(add.options.body.get(`torrents`) instanceof Blob)
  })

  it(`waits for an accepted torrent to become visible`, async () => {
    let infoCalls = 0
    const fixture = mockQbittorrent({
      sync: [fullSync({})],
      route(call) {
        if (call.url.pathname.endsWith(`/torrents/info`)) {
          infoCalls++
          return response(
            infoCalls < 3 ? [] : [torrentFixture({ hash: HASH_A, name: `visible` })]
          )
        }
      },
    })
    const connector = await makeConnector(fixture)

    const result = await connector.addTorrent({
      filename: `magnet:?xt=urn:btih:${HASH_A}&dn=eventual`,
    })

    assert.equal(result[`torrent-added`].hashString, HASH_A)
    assert.equal(result[`torrent-added`].name, `visible`)
    assert.equal(infoCalls, 3)
    assert.equal(connector.count(), 1)
  })

  it(`fails when an accepted torrent remains unavailable`, async () => {
    const waits = []
    const fixture = mockQbittorrent({
      version: `v5.2.3`,
      sync: [fullSync({})],
      info: [],
      addResult: {
        success_count: 1,
        failure_count: 0,
        pending_count: 0,
        added_torrent_ids: [HASH_A],
      },
    })
    const connector = await makeConnector(fixture, {
      wait: (milliseconds) => waits.push(milliseconds),
    })

    await assert.rejects(
      connector.addTorrent({
        filename: `magnet:?xt=urn:btih:${HASH_A}&dn=unavailable`,
      }),
      /accepted the torrent add, but it was not visible within 30 seconds/
    )

    assert.equal(connector.count(), 0)
    assert.deepEqual(waits, Array(30).fill(1000))
  })

  it(`rejects qBittorrent's legacy failure response`, async () => {
    const fixture = mockQbittorrent({
      sync: [fullSync({})],
      addResult: `Fails.`,
    })
    const connector = await makeConnector(fixture)

    await assert.rejects(
      connector.addTorrent({ filename: `magnet:?xt=urn:btih:${HASH_A}` }),
      /rejected the torrent add request/
    )
    assert.equal(connector.count(), 0)
  })

  it(`returns a cached torrent as a duplicate without adding it again`, async () => {
    const fixture = mockQbittorrent({
      version: `v5.2.3`,
      sync: [fullSync({ [HASH_A]: torrentFixture({ hash: HASH_A }) })],
    })
    const connector = await makeConnector(fixture)

    const result = await connector.addTorrent({
      filename: `magnet:?xt=urn:btih:${HASH_A}`,
    })

    assert.equal(result[`torrent-duplicate`].hashString, HASH_A)
    assert(
      !fixture.calls.some((call) => call.url.pathname.endsWith(`/torrents/add`))
    )
  })

  it(`reports success when post-add bookkeeping fails`, async () => {
    const metainfo = Buffer.from(
      `d4:infod6:lengthi2e4:name4:test12:piece lengthi16384e6:pieces20:abcdefghijklmnopqrstee`
    ).toString(`base64`)
    const hash = metainfoHashes(metainfo)[0]
    const errors = []
    const fixture = mockQbittorrent({
      sync: [fullSync({})],
      info: [torrentFixture({ hash, name: `test` })],
    })
    const connector = await makeConnector(fixture, {
      logger: { debug() {}, error: (message) => errors.push(message) },
      torrentStore: {
        async save() {
          throw new Error(`disk unavailable`)
        },
      },
    })

    const result = await connector.addTorrent({ metainfo })

    assert.equal(result[`torrent-added`].hashString, hash)
    assert.match(errors[0], /saving metainfo failed: disk unavailable/)
  })
})

async function makeConnector(fixture, overrides = {}) {
  const ids = new Map()
  return Qbittorrent(
    {
      id: `qbt`,
      url: `http://qbt.test:8080`,
      pollInterval: 1000,
    },
    {
      fetch: fixture.fetch,
      logger: { debug() {}, error() {} },
      now: () => 100000,
      schedule() {},
      wait() {},
      reportStatus() {},
      torrentStore: {},
      globalId(clientId, nativeId) {
        if (!ids.has(nativeId)) ids.set(nativeId, ids.size + 1)
        return ids.get(nativeId)
      },
      ...overrides,
    }
  )
}

function mockQbittorrent({
  version = `v5.1.2`,
  sync = [],
  info = [],
  addResult = `Ok.`,
  files = [],
  trackers = [],
  defaultSavePath = `/downloads`,
  route,
} = {}) {
  const calls = []
  return {
    calls,
    async fetch(input, options = {}) {
      const call = { url: new URL(input), options }
      calls.push(call)
      const custom = route?.(call)
      if (custom) return custom
      const pathname = call.url.pathname
      if (pathname.endsWith(`/auth/login`)) {
        return response(`Ok.`, {
          headers: { "Set-Cookie": `SID=test-session; HttpOnly; Path=/` },
        })
      }
      if (pathname.endsWith(`/app/version`)) return response(version)
      if (pathname.endsWith(`/sync/maindata`)) {
        return response(sync.shift() || { rid: 999, full_update: false })
      }
      if (pathname.endsWith(`/torrents/info`)) return response(info)
      if (pathname.endsWith(`/torrents/add`)) return response(addResult)
      if (pathname.endsWith(`/torrents/files`)) return response(files)
      if (pathname.endsWith(`/torrents/trackers`)) return response(trackers)
      if (pathname.endsWith(`/app/defaultSavePath`)) return response(defaultSavePath)
      return response(``)
    },
  }
}

function response(value, { status = 200, headers = {} } = {}) {
  if (typeof value === `object`) {
    headers = { "Content-Type": `application/json`, ...headers }
    value = JSON.stringify(value)
  }
  return new Response(value, { status, headers })
}

function fullSync(torrents) {
  return { rid: 1, full_update: true, torrents }
}

function torrentFixture(overrides = {}) {
  return {
    hash: HASH_A,
    name: `example`,
    state: `downloading`,
    progress: 0.5,
    total_size: 100,
    size: 100,
    completed: 50,
    amount_left: 50,
    added_on: 10,
    completion_on: -1,
    last_activity: 20,
    save_path: `/downloads`,
    downloaded: 50,
    uploaded: 25,
    dlspeed: 10,
    upspeed: 5,
    dl_limit: -1,
    up_limit: -1,
    num_leechs: 2,
    num_seeds: 3,
    num_incomplete: 8,
    num_complete: 12,
    ratio: 0.5,
    priority: 1,
    tags: ``,
    category: ``,
    tracker: ``,
    time_active: 20,
    seeding_time: 0,
    ...overrides,
  }
}

function form(call) {
  return call.options.body
}
