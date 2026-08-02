import assert from "assert"

import { assertConnector, capabilities } from "./contract.js"

function connector(overrides = {}) {
  return {
    id: `test`,
    type: `fixture`,
    capabilities: capabilities(),
    count() {},
    get() {},
    getAll() {},
    getRecent() {},
    ...overrides,
  }
}

describe(`connector contract`, () => {
  it(`normalizes capabilities`, () => {
    const result = assertConnector(
      connector({
        capabilities: { addTorrent: true },
        addTorrent() {},
      })
    )

    assert.equal(result.capabilities.addTorrent, true)
    assert.equal(result.capabilities.removeTorrents, false)
  })

  it(`requires declared capabilities to be implemented`, () => {
    assert.throws(
      () =>
        assertConnector(
          connector({ capabilities: { removeTorrents: true } })
        ),
      /does not implement/
    )
  })

  it(`validates the configured connector identity`, () => {
    assert.throws(
      () =>
        assertConnector(connector({ type: `wrong` }), {
          id: `test`,
          type: `expected`,
        }),
      /returned type "wrong", expected "expected"/
    )
  })
})
