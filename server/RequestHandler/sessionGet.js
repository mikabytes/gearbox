export default function sessionGet(clients, args) {
  if (!args.fields) {
    return defaults
  }

  if (!Array.isArray(args.fields)) {
    throw new Error(`fields must be an array`)
  }

  const ret = {}

  for (const field of args.fields) {
    ret[field] = defaults[field]
  }
  return ret
}

const defaults = {
  "alt-speed-down": 50,
  "alt-speed-enabled": false,
  "alt-speed-time-begin": 540,
  "alt-speed-time-day": 127,
  "alt-speed-time-enabled": false,
  "alt-speed-time-end": 1020,
  "alt-speed-up": 50,
  "blocklist-enabled": false,
  "blocklist-size": 0,
  "blocklist-url": "http://www.example.com/blocklist",
  "cache-size-mb": 4,
  "config-dir": "/config",
  "default-trackers": "",
  "dht-enabled": false,
  "download-dir": "/torrents",
  "download-dir-free-space": 4259163668480,
  "download-queue-enabled": true,
  "download-queue-size": 10,
  encryption: "preferred",
  "idle-seeding-limit-enabled": false,
  "idle-seeding-limit": 30,
  "incomplete-dir-enabled": false,
  "incomplete-dir": "/torrents/incomplete",
  "lpd-enabled": false,
  "peer-limit-global": 200,
  "peer-limit-per-torrent": 50,
  "peer-port-random-on-start": false,
  "peer-port": 51413,
  "pex-enabled": false,
  "port-forwarding-enabled": true,
  "queue-stalled-enabled": true,
  "queue-stalled-minutes": 30,
  "rename-partial-files": true,
  "rpc-version-minimum": 14,
  "rpc-version-semver": `5.3.0`,
  "rpc-version": 17,
  "script-torrent-added-enabled": false,
  "script-torrent-added-filename": "",
  "script-torrent-done-enabled": false,
  "script-torrent-done-filename": "",
  "script-torrent-done-seeding-enabled": false,
  "script-torrent-done-seeding-filename": "",
  "seed-queue-enabled": false,
  "seed-queue-size": 10,
  seedRatioLimit: 2,
  seedRatioLimited: false,
  "session-id": "made-up-session-id",
  "speed-limit-down-enabled": false,
  "speed-limit-down": 100,
  "speed-limit-up-enabled": false,
  "speed-limit-up": 100,
  "start-added-torrents": true,
  "trash-original-torrent-files": false,
  units: {
    "memory-bytes": 1024,
    "memory-units": ["KiB", "MiB", "GiB", "TiB"],
    "size-bytes": 1000,
    "size-units": ["kB", "MB", "GB", "TB"],
    "speed-bytes": 1000,
    "speed-units": ["kB/s", "MB/s", "GB/s", "TB/s"],
  },
  "utp-enabled": false,
  version: `${process.env.npm_package_version} (Gearbox)`,
}
