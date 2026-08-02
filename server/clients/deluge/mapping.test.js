import assert from "assert"

import {
  applyFileSelection,
  CHECK,
  DOWNLOAD_WAIT,
  mapStatus,
  mapTorrent,
  SEED_WAIT,
} from "./mapping.js"

describe(`Deluge torrent mapping`, () => {
  it(`normalizes Deluge status, files, trackers, peers, and Label data`, () => {
    const torrent = mapTorrent(
      `A`.repeat(40),
      {
        state: `Downloading`,
        progress: 25,
        name: `Example`,
        label: `sonarr`,
        download_location: `/data`,
        total_size: 1000,
        total_wanted: 800,
        total_done: 200,
        total_uploaded: 50,
        download_payload_rate: 123,
        upload_payload_rate: 45,
        files: [
          { index: 0, path: `Example/one.mkv`, size: 600 },
          { index: 1, path: `Example/two.mkv`, size: 400 },
        ],
        file_progress: [0.5, 25],
        file_priorities: [4, 0],
        trackers: [{ url: `udp://tracker.example/announce`, tier: 0 }],
        tracker_status: `Announce OK`,
        total_seeds: 12,
        total_peers: 7,
        peers: [
          {
            ip: `10.0.0.1`,
            client: `libtorrent`,
            progress: 50,
            down_speed: 10,
            up_speed: 20,
          },
        ],
      },
      { now: () => 500000 }
    )

    assert.equal(torrent.hashString, `a`.repeat(40))
    assert.equal(torrent.status, 4)
    assert.equal(torrent.percentDone, 0.25)
    assert.equal(torrent.leftUntilDone, 600)
    assert.equal(torrent.files[0].bytesCompleted, 300)
    assert.equal(torrent.files[1].bytesCompleted, 100)
    assert.deepEqual(torrent.wanted, [true, false])
    assert.deepEqual(torrent.priorities, [0, 0])
    assert.deepEqual(torrent.labels, [`sonarr`])
    assert.equal(torrent.trackers[0].announce, `udp://tracker.example/announce`)
    assert.equal(torrent.trackerStats[0].seederCount, 12)
    assert.equal(torrent.peers[0].progress, 0.5)
  })

  it(`maps queued checking and v2 hashes`, () => {
    assert.equal(mapStatus(`Checking`), CHECK)
    assert.equal(mapStatus(`Queued`, 0.2), DOWNLOAD_WAIT)
    assert.equal(mapStatus(`Queued`, 1), SEED_WAIT)
    assert.equal(
      mapTorrent(`B`.repeat(64), { name: `v2` }).hashString,
      `b`.repeat(64)
    )
  })

  it(`translates Transmission file selection to Deluge priorities`, () => {
    assert.deepEqual(
      applyFileSelection(
        [4, 4, 4],
        {
          filesWanted: [0, 2],
          "priority-high": [2],
          filesUnwanted: [0],
        },
        `hash`
      ),
      [0, 0, 7]
    )
    assert.throws(
      () => applyFileSelection([4], { filesWanted: [2] }, `hash`),
      /Invalid file index/
    )
  })
})
