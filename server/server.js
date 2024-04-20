import express from "express"
import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import compression from "compression"
import hotserve from "hotserve"
import path from "path"
import { fileURLToPath } from "url"
import { rateLimit } from "express-rate-limit"

// Convert the URL of the current module to a file path
const __filename = fileURLToPath(import.meta.url)
// Get the directory name of the current module
const __dirname = path.dirname(__filename)

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
  standardHeaders: "draft-7", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
})

export default function start({ stream, getAll, request, count, config }) {
  const app = express()
  if (process.env.NODE_ENV === `development`) {
    hotserve({ dir: `.`, pattern: `*.{js,css,html}`, app })
  }
  const clients = new Map()

  stream((event) => {
    clients.forEach((write) => {
      write(event)
    })
  })

  app.use(limiter)
  app.use(express.static(path.join(__dirname, `..`, `public`)))
  app.use(bodyParser.json({ limit: `10mb` }))
  app.use(cookieParser())

  app.get(`/config`, (req, res) => {
    res.json(config)
  })

  // Does something similar to torrent-get Transmission RPC call,
  // but places each torrent on its own line and includes the total
  // torrent count so that we may parse torrents as they are received
  // and animate the startup screen
  app.get(`/all`, compression(), (req, res) => {
    res.setHeader(`Content-Type`, `text/json+lines`)

    const iterator = getAll()
    const firstItem = iterator.next().value

    if (!firstItem) {
      res.write(`{"keys": [], "total": 0}\n`)
      res.end()
      return
    }
    const keys = Object.keys(firstItem)

    function writeLine(item) {
      res.write(JSON.stringify(keys.map((k) => item[k])))
      res.write(`\n`)
    }

    // first line is metadata
    res.write(JSON.stringify({ keys, total: count() }))
    res.write(`\n`)

    // ...then each line is only values, without keys
    // all objects have the same keys, so we save 60% bandwidth
    writeLine(firstItem)

    let ids = new Set()
    for (const t of iterator) {
      if (ids.has(t.id)) {
        console.log(`Tried to send duplicate id '${t.name}'`)
        continue
      }
      ids.add(t.id)
      writeLine(t)
    }

    res.end()
  })

  // stream changed fields in realtime. This endpoint does not send whole objects
  app.get(`/stream`, (req, res) => {
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders() // flush the headers to establish SSE with client

    const client = {
      incr: 0,
      res,
    }

    function write(fields) {
      const msg = {
        incr: client.incr++,
        ...fields,
      }
      client.res.write(`data: ${JSON.stringify(msg)}\n\n`)
    }

    clients.set(write, write)

    res.on(`close`, () => {
      clients.delete(write)
    })
  })

  app.all(`/transmission/rpc`, compression(), async (req, res) => {
    const { method, arguments: args, tag } = req.body
    // strikethrough while they're being removed
    if (method === `torrent-remove`) {
      clients.forEach((write) => {
        args.ids.forEach((id) => {
          write({ id, changeSet: { isRemoving: true } })
        })
      })
    }

    try {
      const returnArgs = await request(method, args)

      res.json({ result: `success`, arguments: returnArgs, tag })
    } catch (e) {
      // revert strikethrough
      if (method === `torrent-remove`) {
        clients.forEach((write) => {
          args.ids.forEach((id) => {
            write({ id, changeSet: { isRemoving: false } })
          })
        })
      }
      console.error(e)
      res.status(400).json({ result: `${e.message}`, tag })
    }
  })

  app.listen(config.port, config.ip)
  console.log(`Gearbox started on http://${config.ip}:${config.port}`)
}
