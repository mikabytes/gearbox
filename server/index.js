#!/usr/bin/env node

import { join, relative } from "path"
import { pathToFileURL, fileURLToPath } from "url"
import fs from "fs/promises"

import RequestHandler from "./RequestHandler.js"
import clients from "./clients/index.js"
import start from "./server.js"

let cb
let initialized

const workdir = process.env.GEARBOX_PATH || process.cwd()

// The path to the config file
const configPath = `config.mjs`

// Generating a relative path from the current file to the config file
const configPathRelative = relative(
  join(fileURLToPath(import.meta.url), `/..`),
  join(workdir, configPath)
)

// Convert the relative path to an absolute path
const configAbsolutePath = join(workdir, configPath)

console.log(`Using configuration file at ${configAbsolutePath}`)

// Convert the absolute path to a file URL (necessary for Windows compatibility)
const configFileURL = pathToFileURL(configAbsolutePath).href

let exists
try {
  exists = await fs.stat(configAbsolutePath)
} catch (e) {
  exists = false
}

if (!exists) {
  await fs.writeFile(
    configAbsolutePath,
    `export default {
  backends: [
    {
      id: "main",
      ip: "127.0.0.1",
      port: 9091,
      user: "",
      password: "",
    }
  ],
}`
  )
}

const config = (await import(configFileURL)).default

const connectors = new Map()

await Promise.all(
  config.backends.map((args) =>
    clients[args.type || "transmission"]({ ...args, changes })
  )
).then((_) => {
  for (let connector of _) {
    connectors.set(connector.id, connector)
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
    for (let c of connectors.values()) {
      yield* c.getAll()
    }
  },
  count() {
    let total = 0
    for (let c of connectors.values()) {
      total += c.count()
    }
    return total
  },
  request: RequestHandler({ connectors }),
})
