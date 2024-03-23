import express from "express"
import ViteExpress from "vite-express"
import bodyParser from "body-parser"
import cookieParser from "cookie-parser"

export default function start({ stream, getAll }) {
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

    for (const t of getAll()) {
      write({ id: t.id, changeSet: t })
    }

    clients.set(write, write)

    res.on(`close`, () => {
      clients.delete(write)
    })
  })

  ViteExpress.listen(app, 3000)
}
