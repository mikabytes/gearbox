import assert from "assert"
import basicAuth from "./basicAuth.js"

function makeRes() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    set(name, value) {
      this.headers[name] = value
      return this
    },
    status(code) {
      this.statusCode = code
      return this
    },
    send(body) {
      this.body = body
      return this
    },
  }
}

function header(username, password) {
  return `Basic ` + Buffer.from(`${username}:${password}`).toString(`base64`)
}

describe(`basic auth`, () => {
  const middleware = basicAuth({ username: `user`, password: `secret` })

  it(`accepts matching credentials`, () => {
    let nextCalled = false
    const res = makeRes()

    middleware(
      { headers: { authorization: header(`user`, `secret`) } },
      res,
      () => {
        nextCalled = true
      }
    )

    assert.equal(nextCalled, true)
    assert.equal(res.statusCode, null)
  })

  it(`accepts a case-insensitive authentication scheme`, () => {
    let nextCalled = false
    const res = makeRes()

    middleware(
      {
        headers: {
          authorization: header(`user`, `secret`).replace(`Basic`, `basic`),
        },
      },
      res,
      () => {
        nextCalled = true
      }
    )

    assert.equal(nextCalled, true)
  })

  it(`rejects wrong credentials`, () => {
    let nextCalled = false
    const res = makeRes()

    middleware(
      { headers: { authorization: header(`user`, `wrong`) } },
      res,
      () => {
        nextCalled = true
      }
    )

    assert.equal(nextCalled, false)
    assert.equal(res.statusCode, 401)
  })

  it(`challenges requests without credentials`, () => {
    let nextCalled = false
    const res = makeRes()

    middleware({ headers: {} }, res, () => {
      nextCalled = true
    })

    assert.equal(nextCalled, false)
    assert.equal(res.statusCode, 401)
    assert.match(res.headers[`WWW-Authenticate`], /^Basic realm=/)
  })

  it(`rejects an unsupported authorization scheme`, () => {
    let nextCalled = false
    const res = makeRes()

    middleware(
      { headers: { authorization: `Bearer some-token` } },
      res,
      () => {
        nextCalled = true
      }
    )

    assert.equal(nextCalled, false)
    assert.equal(res.statusCode, 401)
  })

  it(`rejects malformed basic credentials`, () => {
    let nextCalled = false
    const res = makeRes()

    middleware(
      {
        headers: {
          authorization: `${header(`user`, `secret`)}!!!`,
        },
      },
      res,
      () => {
        nextCalled = true
      }
    )

    assert.equal(nextCalled, false)
    assert.equal(res.statusCode, 401)
  })
})
