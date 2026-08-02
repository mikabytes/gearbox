import assert from "assert"

import Requester from "./Requester.js"

describe(`qBittorrent Requester`, () => {
  it(`accepts subnet-auth bypass and requests without a SID cookie`, async () => {
    const calls = []
    const fetch = async (url, options) => {
      calls.push({ url: `${url}`, options })

      if (`${url}`.endsWith(`/api/v2/auth/login`)) {
        return response(204)
      }
      if (`${url}`.endsWith(`/api/v2/app/version`)) {
        return response(200, `v5.2.3`)
      }
      throw new Error(`Unexpected URL ${url}`)
    }
    const requester = Requester(`http://qbit`, {
      username: ``,
      password: ``,
      fetch,
    })

    await requester.login()
    const version = await requester.request(`app/version`, {
      responseType: `text`,
    })

    assert.equal(version, `v5.2.3`)
    assert.equal(calls.length, 2)
    assert.equal(`Cookie` in calls[1].options.headers, false)
  })
})

function response(status, body = ``) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: ``,
    headers: {
      get() {
        return null
      },
      getSetCookie() {
        return []
      },
    },
    async text() {
      return body
    },
  }
}
