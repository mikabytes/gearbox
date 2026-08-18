import compression from "compression"
import express, { request } from "express"
import { readFileSync } from "fs"

import all from "./all.js"
import logger from "../logger.js"
import rpc from "./rpc.js"
import streaming from "./streaming.js"
import _jsonBigint from "json-bigint"

const jsonBigint = _jsonBigint({ useNativeBigInt: true })
const { version } = JSON.parse(
  readFileSync(new URL(`../../package.json`, import.meta.url), `utf8`)
)

export default function makeApi({
  stream,
  getAll,
  request,
  count,
  publicConfig,
}) {
  const connections = new Map()

  const app = express.Router()

  // some clients don't specify its json, and some send int64 tags
  app.use(
    express.text({
      limit: `10mb`,
      type: `*/*`,
    })
  )
  app.use((req, res, next) => {
    try {
      req.rawBody = req.body
      if (req.method !== `GET` && req.body) {
        req.body = jsonBigint.parse(req.body)
      }
    } catch (e) {
      logger.error(e)
    }
    next()
  })
  app.get(`/stream`, streaming({ stream, connections }))
  app.all(`/transmission/rpc`, compression(), rpc({ request, connections }))
  app.get(`/version`, (req, res) => {
    res.json({ version })
  })
  app.get(`/all`, compression(), all({ getAll, count }))
  app.get(`/config`, (req, res) => {
    const config = { ...publicConfig() }
    delete config.auth
    res.json(config)
  })

  return app
}
