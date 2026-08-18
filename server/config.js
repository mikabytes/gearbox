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
      type: "transmission",
      url: "http://127.0.0.1:9091",
      username: "",
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

  if (!Array.isArray(config.clients)) {
    throw new Error(`Configuration must contain a clients array`)
  }

  if (config.clients.length > 511) {
    throw new Error(`Gearbox supports at most 511 configured clients`)
  }

  const clientIds = new Set()

  for (const client of config.clients) {
    if (!client.id || typeof client.id !== `string`) {
      throw new Error(`Every client must have a non-empty id`)
    }
    if (!/^[a-z0-9]+$/.test(client.id)) {
      throw new Error(`Client id "${client.id}" must contain only a-z and 0-9`)
    }
    if (clientIds.has(client.id)) {
      throw new Error(`Client id "${client.id}" is configured more than once`)
    }
    clientIds.add(client.id)

    if (!client.type) {
      client.type = `transmission`
    }

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

    if (!client.username && client.user) {
      client.username = client.user
    }
    if (!client.user && client.username) {
      client.user = client.username
    }

    if (client.url) {
      try {
        client.url = new URL(client.url).toString().replace(/\/$/, ``)
      } catch {
        throw new Error(`Client "${client.id}" has an invalid url`)
      }
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
  }

  if (config.auth !== undefined && config.auth !== null) {
    if (typeof config.auth !== `object`) {
      throw new Error(`'auth' must be an object with username and password`)
    }
    if (!config.auth.username || typeof config.auth.username !== `string`) {
      throw new Error(`'auth' must contain a non-empty username`)
    }
    if (/[\u0000-\u001f\u007f]/.test(config.auth.username)) {
      throw new Error(`'auth' username must not contain control characters`)
    }
    if (config.auth.username.includes(`:`)) {
      throw new Error(`'auth' username must not contain a colon`)
    }
    if (!config.auth.password || typeof config.auth.password !== `string`) {
      throw new Error(`'auth' must contain a non-empty password`)
    }
    if (/[\u0000-\u001f\u007f]/.test(config.auth.password)) {
      throw new Error(`'auth' password must not contain control characters`)
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
