import assert from "assert"
import { once } from "events"

import logger from "./logger.js"
import start from "./server.js"

const credentials = { username: `admin`, password: `secret` }
const authorization =
  `Basic ` + Buffer.from(`admin:secret`).toString(`base64`)

function makeArgs(auth = credentials) {
  const config = {
    ip: `127.0.0.1`,
    port: 0,
    ...(auth ? { auth } : {}),
  }

  return {
    config,
    stream() {},
    *getAll() {},
    async request() {
      return {}
    },
    count() {
      return 0
    },
    publicConfig() {
      return {
        addTorrentStrategy: `least-count`,
        auth: config.auth,
      }
    },
  }
}

async function listen(auth = credentials) {
  const server = start(makeArgs(auth))
  if (!server.listening) await once(server, `listening`)

  return {
    server,
    url: `http://127.0.0.1:${server.address().port}`,
  }
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
    server.closeAllConnections()
  })
}

describe(`server authentication`, () => {
  const originalNodeEnv = process.env.NODE_ENV

  before(() => {
    process.env.NODE_ENV = `test`
  })

  after(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  it(`protects the web UI, static assets, stream, RPC, and API`, async () => {
    const { server, url } = await listen()

    try {
      for (const path of [
        `/`,
        `/index.js`,
        `/stream`,
        `/transmission/rpc`,
        `/config`,
      ]) {
        const response = await fetch(`${url}${path}`)
        assert.equal(response.status, 401, path)
        assert.match(response.headers.get(`www-authenticate`), /^Basic realm=/)
        await response.text()
      }
    } finally {
      await close(server)
    }
  })

  it(`allows authenticated access without exposing auth configuration`, async () => {
    const { server, url } = await listen()
    const headers = { Authorization: authorization }

    try {
      for (const path of [`/`, `/index.js`]) {
        const response = await fetch(`${url}${path}`, { headers })
        assert.equal(response.status, 200, path)
        await response.text()
      }

      const configResponse = await fetch(`${url}/config`, { headers })
      assert.equal(configResponse.status, 200)
      assert.deepEqual(await configResponse.json(), {
        addTorrentStrategy: `least-count`,
      })

      const rpcResponse = await fetch(`${url}/transmission/rpc`, {
        method: `POST`,
        headers: {
          ...headers,
          "Content-Type": `application/json`,
          "X-Transmission-Session-Id": `GEARBOX`,
        },
        body: JSON.stringify({ method: `session-get`, arguments: {} }),
      })
      assert.equal(rpcResponse.status, 200)
      await rpcResponse.text()

      const streamResponse = await fetch(`${url}/stream`, { headers })
      assert.equal(streamResponse.status, 200)
      await streamResponse.body.cancel()
    } finally {
      await close(server)
    }
  })

  it(`leaves routes open when authentication is not configured`, async () => {
    const { server, url } = await listen(null)

    try {
      const response = await fetch(`${url}/`)
      assert.equal(response.status, 200)
      await response.text()
    } finally {
      await close(server)
    }
  })

  it(`logs rejected requests without logging credentials`, async () => {
    const messages = []
    const originalHttp = logger.http
    logger.http = (message) => messages.push(message)
    const { server, url } = await listen()
    const rejectedAuthorization =
      `Basic ` + Buffer.from(`admin:wrong`).toString(`base64`)

    try {
      const response = await fetch(`${url}/config`, {
        headers: { Authorization: rejectedAuthorization },
      })
      assert.equal(response.status, 401)
      await response.text()

      assert.equal(messages.length, 1)
      assert.match(messages[0], /GET \/config 401/)
      assert.doesNotMatch(messages[0], /admin|wrong/)
      assert.equal(messages[0].includes(rejectedAuthorization), false)
    } finally {
      logger.http = originalHttp
      await close(server)
    }
  })
})
