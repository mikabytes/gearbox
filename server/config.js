import fs from "fs/promises"

let config

export default function getConfig() {
  return config
}

export async function loadConfig(configFileUrl, absolutePath, workdir) {
  console.log(`Using configuration file at ${absolutePath}`)

  let exists
  try {
    exists = await fs.stat(absolutePath)
  } catch (e) {
    exists = false
  }

  if (!exists) {
    await fs.writeFile(
      absolutePath,
      `export default {
  clients: [
    {
      id: "main",
      host: "127.0.0.1",
      port: 9091,
      user: "",
      password: "",
      //torrentDir: "/config/torrents" // uncomment to enable moving torrents between clients
    }
  ],
  ip: "127.0.0.1",
  port: 2112,
  addTorrentStrategy: "least-count",
  logLevel: "warn",
}`
    )
  }

  config = (await import(configFileUrl)).default

  config.workdir = workdir

  // this field used to be called backends, we keep supporting it
  if (!config.clients && config.backends) {
    config.clients = config.backends
  }

  for (const client of config.clients) {
    // set defaults
    if (
      client.maxCount === undefined ||
      client.maxCount === null ||
      client.maxCount < 0
    ) {
      client.maxCount = -1
    }

    // this field used to be called ip, we keep supporting it
    if (!client.host && client.ip) {
      client.host = client.ip
    }

    // disallow undefined, null, or empty string
    if (!client.torrentDir) {
      delete client.torrentDir
    } else {
      // sanity check, make sure the path exists
      try {
        const s = await fs.stat(client.torrentDir)
        if (!s.isDirectory()) {
          throw new Error(
            `Torrent directory "${client.torrentDir}" is not a directory`
          )
        }
      } catch (e) {
        throw new Error(
          `Torrent directory "${client.torrentDir}" does not exist`
        )
      }
    }

    if (!client.type) {
      client.type = `transmission`
    }
  }

  if (!config.addTorrentStrategy) {
    config.addTorrentStrategy = `least-count`
  }

  if (
    ![`least-count`, `round-robin`, `first-found`].includes(
      config.addTorrentStrategy
    )
  ) {
    throw new Error(
      `Invalid 'addTorrentStrategy', got ${config.addTorrentStrategy} but should be one of "least-count", "round-robin", or "first-found"`
    )
  }

  if (!config.ip) {
    config.ip = `127.0.0.1`
  }

  if (!config.port) {
    config.port = 2112
  }

  if (!config.logLevel) {
    config.logLevel = `warn`
  }

  return config
}
