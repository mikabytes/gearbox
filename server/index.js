#!/usr/bin/env node

import "es-iterator-helpers/auto"

import { join, relative } from "path"
import { pathToFileURL, fileURLToPath } from "url"

import { loadConfig } from "./config.js"
import RequestHandler from "./RequestHandler/index.js"
import clientImplementations from "./clients/index.js"
import ClientManager from "./clients/ClientManager.js"
import IdAllocator from "./clients/shared/IdAllocator.js"
import TorrentStore from "./clients/shared/TorrentStore.js"
import * as guid from "./guid.js"
import logger from "./logger.js"
import { setLevels as loggerSetLevels } from "./logger.js"
import start from "./server.js"
import { load as loadState } from "./state.js"

let cb
let initialized

// Convert the relative path of config to an absolute path compatible with Windows
const workdir = process.env.GEARBOX_PATH || process.cwd()
const configPath = `config.mjs`
const configPathRelative = relative(
  join(fileURLToPath(import.meta.url), `/..`),
  join(workdir, configPath)
)
const configAbsolutePath = join(workdir, configPath)
const configFileURL = pathToFileURL(configAbsolutePath).href

const config = await loadConfig(configFileURL, configAbsolutePath, workdir)
await loadState(join(workdir, `state.json`))
loggerSetLevels(config.logLevel)

const idAllocator = await IdAllocator({
  filename: join(workdir, `torrent-ids.json`),
  logger,
})
const torrentStore = await TorrentStore({ workdir, logger })
const clientManager = ClientManager({
  clientConfigs: config.clients,
  implementations: clientImplementations,
  logger,
  dependencies: {
    changes,
    fetch: globalThis.fetch,
    logger,
    now: Date.now,
    schedule: setTimeout,
    torrentStore,
    globalId(clientId, nativeId) {
      return guid.encode({
        clientId,
        torrentId: idAllocator.allocate(clientId, nativeId),
      })
    },
  },
})
const clients = await clientManager.start()
await idAllocator.flush()

initialized = true

function changes(entry) {
  if (!initialized) {
    return
  }

  cb?.(entry)

  const { id, changeSet, isRemoved } = entry
}

start({
  config,
  stream(newCb) {
    cb = newCb
  },
  *getAll() {
    for (let c of clients.values()) {
      yield* c.getAll()
    }
  },
  count() {
    let total = 0
    for (let c of clients.values()) {
      total += c.count()
    }
    return total
  },
  request: RequestHandler({ clients, config }),
  publicConfig() {
    return {
      addTorrentStrategy: config.addTorrentStrategy,
      clients: clientManager.publicClients(),
    }
  },
})
