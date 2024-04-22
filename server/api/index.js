import compression from "compression"
import express, { request } from "express"

import all from "./all.js"
import limiter from "./rateLimiter.js"
import logger from "../logger.js"
import loggerMiddleware from "./loggerMiddleware.js"
import rpc from "./rpc.js"
import streaming from "./streaming.js"

export default function makeApi({ stream, getAll, request, count, config }) {
  const connections = new Map()

  const app = express.Router()

  app.use(loggerMiddleware)
  app.use(limiter)
  app.use(
    express.json({
      limit: `10mb`,
      type(req) {
        if (!req.header("content-type")) {
          return true
        }
        if (req.header("content-type").includes(`application/json`)) {
          return true
        }
        return false
      },
    })
  )
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
