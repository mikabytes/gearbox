export default function streaming({ stream, connections }) {
  stream((event) => {
    connections.forEach((write) => {
      write(event)
    })
  })

  return (req, res) => {
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

    connections.set(write, write)

    res.on(`close`, () => {
      connections.delete(write)
    })
  }
}
