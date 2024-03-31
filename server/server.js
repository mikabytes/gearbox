import express from "express"
import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import compression from "compression"
import hotserve from "hotserve"
import path from "path"
import { fileURLToPath } from "url"

// Convert the URL of the current module to a file path
const __filename = fileURLToPath(import.meta.url)
// Get the directory name of the current module
const __dirname = path.dirname(__filename)

export default function start({ stream, getAll, remove, request, count }) {
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

  app.use(express.static(path.join(__dirname, `..`, `public`)))
  app.use(bodyParser.json())
  app.use(cookieParser())

  app.get(`/all`, compression(), (req, res) => {
    res.setHeader(`Content-Type`, `text/json+lines`)

    const iterator = getAll()
    const firstItem = iterator.next().value

    if (!firstItem) {
      res.write(`[]\n\n`)
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
    // all objects have the same keys, so we save half 60% bandwidth
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

  app.all(`/transmission/rpc`, async (req, res) => {
    const { method, arguments: args, tag } = req.body
    if (![`torrent-remove`].includes(method)) {
      res.status(501).json({ result: `Not implemented.`, tag })
      return
    }

    try {
      const [error, resultArgs] = await request(method, args)
      if (error) {
        console.error(error)
        res.status(400).json({ result: error.message, tag })
        return
      }

      //clients.forEach((write) => {
      //  args.ids.forEach((id) => {
      //    write({ id, changeSet: { isRemoving: true } })
      //  })
      //})

      res.status(200).send({ ...resultArgs, tag })
    } catch (e) {
      console.error(e)
      res.status(500).json({ result: `${e.message}`, tag })
    }
  })

  app.listen(2112)
  console.log(`Gearbox started on http://localhost:2112`)
}
