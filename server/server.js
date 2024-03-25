import express from "express"
import ViteExpress from "vite-express"
import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import compression from "compression"

export default function start({ stream, getAll, remove, request }) {
  const app = express()
  const clients = new Map()

  stream((event) => {
    clients.forEach((write) => {
      write(event)
    })
  })

  app.use(express.static("public"))
  app.use(bodyParser.json())
  app.use(cookieParser())
  app.use(compression())

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

    // send initial state
    for (const t of getAll()) {
      write({ id: t.id, changeSet: t })
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
      const [error, resultArgs] = await request(args)
      if (error) {
        console.error(error)
        res.status(400).json({ result: error.message, tag })
        return
      }

      res.status(200).send({ ...resultArgs, tag })
    } catch (e) {
      console.error(e)
      res.status(500).json({ result: `${e.message}`, tag })
    }
  })

  ViteExpress.listen(app, 3000)
}
