import { encode, decode } from "./guid.js"
import assert from "assert"

describe(`guid`, () => {
  it(`should handle low limit`, () => {
    assert.deepEqual(decode(encode({ clientId: `1`, torrentId: 0 })), {
      clientId: `1`,
      torrentId: 0,
    })
  })

  it(`should handle high limit`, () => {
    assert.deepEqual(
      decode(encode({ clientId: `zzzzzz`, torrentId: 899999 })),
      {
        clientId: `zzzzzz`,
        torrentId: 899999,
      }
    )
  })

  it(`should test 10000 random combinations`, () => {
    for (let i = 0; i < 10000; i++) {
      const torrentId = Math.floor(Math.random() * 100000)
      const clientId = randomString(6)

      assert.deepEqual(decode(encode({ clientId, torrentId })), {
        torrentId,
        clientId,
      })
    }
  })
})

function randomString(length) {
  let str = ``
  const letters = `abcdefghijklmnopqrstuvwxyz0123456789`
  while (str.length < length) {
    str += letters[Math.round(Math.random() * 35)]
  }
  return str
}
