import compression from "compression"
import express, { request } from "express"

import all from "./all.js"
import logger from "../logger.js"
import loggerMiddleware from "./loggerMiddleware.js"
import rpc from "./rpc.js"
import streaming from "./streaming.js"
import _jsonBigint from "json-bigint"

const jsonBigint = _jsonBigint({ useNativeBigInt: true })

export default function makeApi({ stream, getAll, request, count, config }) {
  const connections = new Map()

  const app = express.Router()

  app.use(loggerMiddleware)
  // some clients don't specify its json, and some send int64 tags
  app.use(
    express.text({
      limit: `10mb`,
      type: `*/*`,
    })
  )
  app.use((req, res, next) => {
    req.rawBody = req.body
    req.body = jsonBigint.parse(req.body)
    next()
  })
  app.get(`/stream`, streaming({ stream, connections }))
  app.all(`/transmission/rpc`, compression(), rpc({ request, connections }))
  app.get(`/version`, (req, res) => {
    res.json({ version: process.env.npm_package_version })
  })
  app.get(`/all`, compression(), all({ getAll, count }))
  app.get(`/config`, (req, res) => {
    res.json(config)
  })

  return app
}
