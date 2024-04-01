#!/usr/bin/env node

import Connector from "./connector.js"
import start from "./server.js"
import * as guid from "./guid.js"
import fs from "fs/promises"
import { join, relative } from "path"
import { pathToFileURL, fileURLToPath } from "url"

let cb
let initialized

// The path to the config file
const configPath = `config.mjs`

// Generating a relative path from the current file to the config file
const configPathRelative = relative(
  join(fileURLToPath(import.meta.url), `/..`),
  join(process.cwd(), configPath)
)

// Convert the relative path to an absolute path
const configAbsolutePath = join(process.cwd(), configPath)

console.log(`Using configuration file at ${configAbsolutePath}`)

// Convert the absolute path to a file URL (necessary for Windows compatibility)
const configFileURL = pathToFileURL(configAbsolutePath).href

let exists
try {
  exists = await fs.stat(configPath)
} catch (e) {
  exists = false
}

if (!exists) {
  await fs.writeFile(
    configPath,
    `export default {
  backends: [
    {
      id: "main",
      ip: "127.0.0.1",
      port: 9091,
      user: ``,
      password: ``,
    }
  ],
}`
  )
}

const config = (await import(configFileURL)).default

const connectors = new Map()

await Promise.all(
  config.backends.map((args) => Connector({ ...args, changes }))
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
  async request(method, args) {
    try {
      const split = byClient(args.ids)
      for (const clientId of Object.keys(split)) {
        const resultArgs = await connectors.get(clientId).request(method, {
          ...args,
          ids: split[clientId],
        })

        console.log()
        console.log(`Request to ${clientId}: ${method} ${JSON.stringify(args)}`)
        console.log(`Response: ${JSON.stringify(resultArgs)}`)
        console.log()

        if (resultArgs.result !== `success`) {
          throw new Error(`${clientId} returned an error: ${resultArgs.result}`)
        }
      }

      return [null, { result: `success` }]
    } catch (e) {
      console.error(e)
      return [e]
    }
  },
})

function byClient(ids) {
  let byClient = {}

  for (let id of ids) {
    const { clientId, torrentId } = guid.decode(id)
    byClient[clientId] ||= []
    byClient[clientId].push(torrentId)
  }
  return byClient
}
