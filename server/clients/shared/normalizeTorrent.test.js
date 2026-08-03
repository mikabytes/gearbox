import assert from "assert"

import normalizeTorrent, { trackerSite } from "./normalizeTorrent.js"

describe(`normalizeTorrent`, () => {
  it(`creates a complete UI-safe torrent`, () => {
    const torrent = normalizeTorrent(
      {
        hashString: `abc`,
        name: `Example`,
        percentDone: 0.5,
        totalSize: 100,
        files: [{ path: `folder/file.mkv`, size: 100 }],
        trackers: [{ url: `udp://tracker.example.com:80/announce` }],
        trackerStats: [{ num_seeds: 4, num_leeches: 2 }],
        labels: [`tv`, `tv`, ``],
      },
      { id: 7, localId: `abc`, clientId: `one`, clientType: `fixture` }
    )

    assert.equal(torrent.id, 7)
    assert.equal(torrent.files[0].name, `folder/file.mkv`)
    assert.equal(torrent.files[0].length, 100)
    assert.equal(torrent.trackers[0].sitename, `tracker.example.com`)
    assert.equal(torrent.trackerStats[0].seederCount, 4)
    assert.equal(torrent.trackerStats[0].lastScrapeTimedOut, false)
    assert.deepEqual(torrent.labels, [`tv`])
    assert.deepEqual(torrent.peers, [])
    assert.equal(torrent.uploadRatio, 0)
    assert.equal(torrent.percentComplete, 0.5)
  })

  it(`extracts tracker hosts without throwing on unusual values`, () => {
    assert.equal(trackerSite(`https://tracker.example/announce`), `tracker.example`)
    assert.equal(trackerSite(`not a url`), `not a url`)
  })

  it(`preserves explicit zero progress values`, () => {
    const torrent = normalizeTorrent({
      name: `magnet`,
      percentDone: 0.5,
      percentComplete: 0,
      metadataPercentComplete: 0,
    })

    assert.equal(torrent.percentComplete, 0)
    assert.equal(torrent.metadataPercentComplete, 0)
  })

  it(`creates Transmission-compatible tracker statistics`, () => {
    const [stats] = normalizeTorrent({
      trackerStats: [
        {
          announce: `udp://tracker.example:80/announce`,
          hasAnnounced: 1,
          lastScrapeTimedOut: 0,
          num_leeches: 2,
          num_seeds: 4,
        },
      ],
    }).trackerStats

    assert.equal(stats.hasAnnounced, true)
    assert.equal(stats.hasScraped, false)
    assert.equal(stats.lastAnnounceSucceeded, false)
    assert.equal(stats.lastAnnounceTimedOut, false)
    assert.equal(stats.lastScrapeSucceeded, false)
    assert.equal(stats.lastScrapeTimedOut, false)
    assert.equal(stats.host, `tracker.example`)
    assert.equal(stats.leecherCount, 2)
    assert.equal(stats.seederCount, 4)
    assert.equal(stats.downloadCount, -1)
    assert.equal(stats.lastAnnounceTime, 0)
    assert.equal(stats.lastScrapeTime, 0)
  })
})
