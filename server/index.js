#!/usr/bin/env node

import "es-iterator-helpers/auto"

import { join, relative } from "path"
import { pathToFileURL, fileURLToPath } from "url"

import { loadConfig } from "./config.js"
import RequestHandler from "./RequestHandler/index.js"
import clientImplementations from "./clients/index.js"
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

const config = await loadConfig(configFileURL, configAbsolutePath)
loadState(join(workdir, `state.json`))
loggerSetLevels(config.logLevel)

const clients = new Map()

await Promise.all(
  config.clients.map((args) => {
    const Client = clientImplementations[args.type || "transmission"]
    return Client({ ...args, changes })
  })
).then((_) => {
  for (let client of _) {
    clients.set(client.id, client)
  }
})

initialized = true

function changes(entry) {
  if (!initialized) {
    return
  }

  cb?.(entry)

  const { id, changeSet, isRemoved } = entry
}

start({
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
  config,
})
