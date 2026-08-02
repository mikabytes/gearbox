import assert from "assert"

import { assertConnector } from "../contract.js"
import Deluge from "./index.js"
import { metainfoHashes } from "./metainfo.js"

const HASH = `a`.repeat(40)

describe(`Deluge connector`, () => {
  it(`selects the already-connected daemon before the default`, async () => {
    const fixture = apiFixture({
      hosts: [
        [`one`, `one.local`, 58846, `localclient`],
        [`two`, `two.local`, 58846, `localclient`],
      ],
      connected: true,
      connectedDaemon: `two`,
      defaultDaemon: `one`,
    })

    const connector = await Deluge(config(), dependencies(fixture))
    assert.equal(connector.count(), 1)
    assert(!fixture.calls.some((call) => call.method === `web.connect`))
    assert.equal(connector.getAll().next().value.clientType, `deluge`)
  })

  it(`uses daemonId and reports ambiguous Web host lists`, async () => {
    const hosts = [
      [`one`, `one.local`, 58846, `localclient`],
      [`two`, `two.local`, 58846, `localclient`],
    ]
    const selected = apiFixture({ hosts, defaultDaemon: `` })
    await Deluge(config({ daemonId: `two` }), dependencies(selected))
    assert.deepEqual(
      selected.calls.find((call) => call.method === `web.connect`).params,
      [`two`]
    )

    const ambiguous = apiFixture({ hosts, defaultDaemon: `` })
    await assert.rejects(
      () => Deluge(config(), dependencies(ambiguous)),
      /multiple daemon hosts/
    )
  })

  it(`polls bulk status, publishes changes, and reconciles removals`, async () => {
    const fixture = apiFixture()
    const scheduled = []
    const changes = []
    const connector = await Deluge(
      config({ pollInterval: 1750, reconcileInterval: 60000 }),
      dependencies(fixture, {
        changes: (change) => changes.push(change),
        schedule: (callback, delay) => scheduled.push({ callback, delay }),
      })
    )
    assert.equal(scheduled[0].delay, 1750)

    fixture.torrents[HASH].progress = 75
    await scheduled.shift().callback()
    assert.equal(connector.getAll().next().value.percentDone, 0.75)
    assert(changes.some((change) => change.changeSet?.percentDone === 0.75))

    delete fixture.torrents[HASH]
    await scheduled.shift().callback()
    assert.equal(connector.count(), 0)
    assert(changes.some((change) => change.isRemoved === true))
    assert.equal(
      fixture.calls.filter((call) => call.method === `core.get_torrents_status`)
        .length,
      3
    )
    const statusCalls = fixture.calls.filter(
      (entry) => entry.method === `core.get_torrents_status`
    )
    assert(statusCalls[0].params[1].includes(`files`))
    assert(!statusCalls[1].params[1].includes(`files`))
    assert.equal(statusCalls[1].params[2], false)
  })

  it(`implements add, selection priorities, and current mutations`, async () => {
    const fixture = apiFixture()
    const connector = assertConnector(
      await Deluge(config(), dependencies(fixture)),
      { id: `deluge` }
    )

    const duplicate = await connector.addTorrent({
      filename: `magnet:?xt=urn:btih:${HASH}`,
    })
    assert.equal(duplicate[`torrent-duplicate`].hashString, HASH)
    assert(
      !fixture.calls.some((entry) => entry.method === `core.add_torrent_magnet`)
    )

    const metainfo = Buffer.from(`d4:infod4:name6:Secondee`).toString(`base64`)
    const addedHash = metainfoHashes(metainfo)[0]
    fixture.addResult = addedHash
    fixture.statuses[addedHash] = torrentStatus({
      hash: addedHash,
      name: `Second`,
      file_priorities: [4, 4, 4],
    })
    const added = await connector.addTorrent({
      metainfo,
      filesWanted: [0, 2],
      "priority-high": [2],
      "download-dir": `/new`,
    })
    assert.equal(added[`torrent-added`].hashString, addedHash)
    assert.deepEqual(call(fixture, `core.add_torrent_file`).params[2], {
      download_location: `/new`,
      add_paused: true,
    })
    assert.deepEqual(
      fixture.calls
        .filter((entry) => entry.method === `core.set_torrent_options`)
        .at(-1).params,
      [[addedHash], { file_priorities: [4, 0, 7] }]
    )
    assert.deepEqual(call(fixture, `core.resume_torrents`).params, [[addedHash]])

    const urlHash = `c`.repeat(40)
    fixture.addResult = urlHash
    fixture.statuses[urlHash] = torrentStatus({
      hash: urlHash,
      name: `From URL`,
    })
    await connector.addTorrent({
      filename: `https://example.test/file.torrent`,
      cookies: `session=one`,
    })
    assert.deepEqual(
      fixture.calls
        .filter((entry) => entry.method === `core.add_torrent_url`)
        .at(-1).params[2],
      { Cookie: `session=one` }
    )

    await connector.setTorrents([HASH], {
      ids: [123],
      downloadLimit: 100,
      uploadLimited: false,
      "peer-limit": 50,
      sequentialDownload: true,
      labels: [`sonarr`],
    })
    assert.deepEqual(
      fixture.calls
        .filter((entry) => entry.method === `core.set_torrent_options`)
        .at(-1).params,
      [
        [HASH],
        {
          max_download_speed: 100,
          max_upload_speed: -1,
          max_connections: 50,
          sequential_download: true,
        },
      ]
    )

    await connector.setLocation([HASH], {
      ids: [123],
      location: `/moved`,
      move: true,
    })
    await connector.startTorrents([HASH], { ids: [123] })
    await connector.startTorrentsNow([HASH], { ids: [123] })
    await connector.stopTorrents([HASH], { ids: [123] })
    await connector.verifyTorrents([HASH], { ids: [123] })
    await connector.reannounceTorrents([HASH], { ids: [123] })
    await connector.moveQueue([HASH], { ids: [123], direction: `top` })
    await connector.renameTorrentPath([HASH], {
      ids: [123],
      path: `First/file.mkv`,
      name: `renamed.mkv`,
    })
    await connector.removeTorrents([HASH], {
      ids: [123],
      "delete-local-data": true,
    })

    for (const method of [
      `core.move_storage`,
      `core.resume_torrents`,
      `core.pause_torrents`,
      `core.force_recheck`,
      `core.force_reannounce`,
      `core.queue_top`,
      `core.remove_torrents`,
      `core.rename_files`,
      `label.set_torrent`,
    ]) {
      assert(call(fixture, method), `${method} was not called`)
    }
    assert.deepEqual(
      await connector.sessionGet({ fields: [`download-dir`] }),
      { "download-dir": `/data` }
    )

    await assert.rejects(
      () => connector.setTorrents([HASH], { ids: [123], seedIdleLimit: 5 }),
      /does not support.*seedIdleLimit/
    )
  })
})

function config(overrides = {}) {
  return {
    id: `deluge`,
    type: `deluge`,
    url: `http://deluge:8112`,
    password: `secret`,
    ...overrides,
  }
}

function dependencies(fixture, overrides = {}) {
  return {
    changes() {},
    fetch: fixture.fetch,
    globalId(clientId, nativeId) {
      const first = nativeId[0]?.toLowerCase().charCodeAt(0) || 0
      return first * 1000
    },
    logger: { debug() {}, error() {} },
    now: () => 1000000,
    reportStatus() {},
    schedule() {},
    torrentStore: {
      async capture({ hash }) {
        return `/gearbox/${hash}.torrent`
      },
      async save({ hash }) {
        return `/gearbox/${hash}.torrent`
      },
    },
    ...overrides,
  }
}

function apiFixture({
  hosts = [[`one`, `localhost`, 58846, `localclient`]],
  connected = false,
  connectedDaemon,
  defaultDaemon = `one`,
} = {}) {
  const fixture = {
    addResult: undefined,
    calls: [],
    connected,
    connectedDaemon,
    defaultDaemon,
    hosts,
    statuses: {},
    torrents: { [HASH]: torrentStatus() },
  }

  fixture.fetch = async (url, options) => {
    const request = JSON.parse(options.body)
    fixture.calls.push({ ...request, cookie: options.headers.Cookie, url })
    let result
    switch (request.method) {
      case `auth.login`:
        return response(true, `_session_id=test; Path=/json`)
      case `web.get_hosts`:
        result = fixture.hosts
        break
      case `web.connected`:
        result = fixture.connected
        break
      case `web.get_host_status`:
        result = [
          request.params[0],
          request.params[0] === fixture.connectedDaemon ? `Connected` : `Online`,
          `2.1.1`,
        ]
        break
      case `web.get_config`:
        result = { default_daemon: fixture.defaultDaemon }
        break
      case `web.connect`:
        fixture.connected = true
        fixture.connectedDaemon = request.params[0]
        result = methods()
        break
      case `system.listMethods`:
        result = methods()
        break
      case `core.get_torrents_status`:
        result = fixture.torrents
        break
      case `core.get_session_state`:
        result = Object.keys(fixture.torrents)
        break
      case `core.add_torrent_file`:
      case `core.add_torrent_magnet`:
      case `core.add_torrent_url`:
        result = fixture.addResult
        break
      case `core.get_torrent_status`:
        result =
          fixture.statuses[request.params[0]] || fixture.torrents[request.params[0]]
        break
      case `core.remove_torrents`:
        result = []
        break
      case `core.get_config_values`:
        result = { download_location: `/data` }
        break
      default:
        result = null
    }
    return response(result)
  }

  return fixture
}

function torrentStatus(overrides = {}) {
  return {
    hash: HASH,
    name: `First`,
    state: `Downloading`,
    progress: 10,
    total_size: 1000,
    total_wanted: 1000,
    total_done: 100,
    total_uploaded: 25,
    download_location: `/data`,
    files: [{ index: 0, path: `First/file.mkv`, size: 1000 }],
    file_progress: [0.1],
    file_priorities: [4],
    trackers: [{ url: `udp://tracker.example/announce`, tier: 0 }],
    ...overrides,
  }
}

function methods() {
  return [
    `core.add_torrent_file`,
    `core.get_torrent_status`,
    `core.set_torrent_options`,
    `label.set_torrent`,
  ]
}

function call(fixture, method) {
  return fixture.calls.find((entry) => entry.method === method)
}

function response(result, setCookie) {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return name.toLowerCase() === `set-cookie` ? setCookie : null
      },
    },
    async json() {
      return { id: 1, result, error: null }
    },
  }
}
