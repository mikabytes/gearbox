import assert from "assert"

import Requester from "./Requester.js"

describe(`Deluge Requester`, () => {
  it(`keeps the Web cookie and renews an expired session`, async () => {
    const calls = []
    let logins = 0
    let protectedCalls = 0
    let renewals = 0
    const fetch = async (url, options) => {
      const request = JSON.parse(options.body)
      calls.push({ url, request, cookie: options.headers.Cookie })

      if (request.method === `auth.login`) {
        logins++
        return response(true, `_session_id=session${logins}; Path=/json`)
      }
      if (request.method === `core.protected`) {
        protectedCalls++
        if (protectedCalls === 1) {
          return response(null, null, {
            message: `Not authenticated`,
            code: 1,
          })
        }
        return response(`ok`)
      }
      throw new Error(`Unexpected method ${request.method}`)
    }

    const requester = Requester(`http://deluge:8112`, {
      password: `secret`,
      fetch,
      onRenew() {
        renewals++
      },
    })

    await requester.login()
    assert.equal(await requester.request(`core.protected`), `ok`)
    assert.equal(logins, 2)
    assert.equal(renewals, 1)
    assert.equal(calls[1].cookie, `_session_id=session1`)
    assert.equal(calls.at(-1).cookie, `_session_id=session2`)
    assert.equal(calls[0].url, `http://deluge:8112/json`)
  })

  it(`rejects an incorrect Web password clearly`, async () => {
    const requester = Requester(`http://deluge`, {
      password: `wrong`,
      fetch: async () => response(false),
    })

    await assert.rejects(() => requester.login(), /password was rejected/)
  })
})

function response(result, setCookie, error = null) {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return name.toLowerCase() === `set-cookie` ? setCookie : null
      },
    },
    async json() {
      return { id: 1, result, error }
    },
  }
}
