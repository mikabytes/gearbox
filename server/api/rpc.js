import logger from "../logger.js"
import _jsonBigint from "json-bigint"

const jsonBigint = _jsonBigint({ useNativeBigInt: true })

export default function rpc({ request, connections }) {
  return async (req, res) => {
    res.setHeader(`X-Transmission-Session-Id`, `GEARBOX`)

    if (req.header(`X-Transmission-Session-Id`) !== `GEARBOX`) {
      res.status(409)
      res.end(
        `<h1>409: Conflict</h1><p>Your request had an invalid session-id header.</p><p>To fix this, follow these steps:<ol><li> When reading a response, get its X-Transmission-Session-Id header and remember it<li> Add the updated header to your outgoing requests<li> When you get this 409 error message, resend your request with the updated header</ol></p><p>This requirement has been added to help prevent <a href="https://en.wikipedia.org/wiki/Cross-site_request_forgery">CSRF</a> attacks.</p><p><code>X-Transmission-Session-Id: GEARBOX</code></p>`
      )
      return
    }

    if (req.method === `GET`) {
      res.status(405)
      res.end(`<h1>405: Method Not Allowed</h1>`)
      return
    }

    const { method, arguments: args, tag } = req.body

    logger.debug(`RPC: ${req.rawBody}`)

    // strikethrough while they're being removed
    if (method === `torrent-remove`) {
      connections.forEach((write) => {
        args.ids.forEach((id) => {
          write({ id, changeSet: { isRemoving: true } })
        })
      })
    }

    try {
      const returnArgs = await request(method, args)

      const response = { result: `success`, arguments: returnArgs, tag }
      logger.debug(`RPC response: ${jsonBigint.stringify(response)}`)

      res.status(200)
      res.header(`Content-Type`, `application/json`)
      res.end(jsonBigint.stringify(response))
    } catch (e) {
      logger.error(e)
      // revert strikethrough
      if (method === `torrent-remove`) {
        connections.forEach((write) => {
          args.ids.forEach((id) => {
            write({ id, changeSet: { isRemoving: false } })
          })
        })
      }
      res.status(400)
      res.header(`Content-Type`, `application/json`)
      res.end(jsonBigint.stringify({ result: `${e.message}`, tag }))
    }
  }
}
