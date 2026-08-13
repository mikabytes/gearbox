import assert from "assert"
import { mergeSettings } from "./settingsStore.js"

describe(`settings store`, () => {
  it(`merges object values one level deep`, () => {
    const base = { columns: { name: true, eta: false }, theme: `classic` }
    const next = mergeSettings(base, { columns: { eta: true } })

    assert.deepEqual(next.columns, { name: true, eta: true })
    assert.equal(next.theme, `classic`)
  })

  it(`replaces primitive and array values`, () => {
    const base = { theme: `classic`, order: [`a`, `b`] }
    const next = mergeSettings(base, { theme: `dark`, order: [`b`] })

    assert.equal(next.theme, `dark`)
    assert.deepEqual(next.order, [`b`])
  })

  it(`does not mutate the base object`, () => {
    const base = { columns: { name: true } }
    mergeSettings(base, { columns: { name: false } })

    assert.equal(base.columns.name, true)
  })
})
