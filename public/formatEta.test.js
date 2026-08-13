import assert from "assert"
import formatEta from "./formatEta.js"

describe(`formatEta`, () => {
  it(`formats seconds into at most two units`, () => {
    assert.equal(formatEta(45), `45s`)
    assert.equal(formatEta(60), `1m`)
    assert.equal(formatEta(135), `2m 15s`)
    assert.equal(formatEta(3600 * 2 + 60 * 15), `2h 15m`)
    assert.equal(formatEta(86400 * 3 + 3600 * 4 + 90), `3d 4h`)
  })

  it(`returns an empty string when the eta is unknown`, () => {
    assert.equal(formatEta(-1), ``)
    assert.equal(formatEta(-2), ``)
    assert.equal(formatEta(undefined), ``)
    assert.equal(formatEta(NaN), ``)
  })

  it(`formats zero as 0s`, () => {
    assert.equal(formatEta(0), `0s`)
  })
})
