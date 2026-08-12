import express from "express"
import hotserve from "hotserve"

import { fileURLToPath } from "url"
import path from "path"

import api from "./api/index.js"
import basicAuth from "./basicAuth.js"

// Convert the URL of the current module to a file path
const __filename = fileURLToPath(import.meta.url)
// Get the directory name of the current module
const __dirname = path.dirname(__filename)

export default function start(args) {
  const app = express()
  if (process.env.NODE_ENV === `development`) {
    hotserve({ dir: `.`, pattern: `*.{js,css,html}`, app })
  }

  if (args.config.auth) {
    app.use(basicAuth(args.config.auth))
  }

  app.use(express.static(path.join(__dirname, `..`, `public`)))
  app.use(api(args))

  const server = app.listen(args.config.port, args.config.ip)

  console.log(`Gearbox started on http://${args.config.ip}:${args.config.port}`)
  return server
}
