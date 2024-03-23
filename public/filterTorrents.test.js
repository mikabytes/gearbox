import { createFilter } from "./filterTorrents.js"
import assert from "assert"

describe("filterTorrents", () => {
  it("should handle single field", () => {
    const filter = createFilter("name", ["baz"])

    assert.equal(
      filter,
      `const values = ["baz"];
if (values.some(val => val == obj.name)) {
  return true
}
`
    )
  })

  it("should handle nested arrays", () => {
    const filter = createFilter("trackers[].sitenames[].name", ["foo", "bar"])

    assert.equal(
      filter,
      `const values = ["foo","bar"];
for (let it of obj.trackers) {
  for (let it of it.sitenames) {
    if (values.some(val => val == it.name)) {
      return true
    }
  }
}
`
    )
  })

  it("should handle mix or arrays and objects", () => {
    const filter = createFilter("arrayone[].subkey.arraytwo[].name", [
      "foo",
      "bar",
    ])

    assert.equal(
      filter,
      `const values = ["foo","bar"];
for (let it of obj.arrayone) {
  for (let it of it.subkey.arraytwo) {
    if (values.some(val => val == it.name)) {
      return true
    }
  }
}
`
    )
  })

  it("should negate when key is prefixed with -", () => {
    const filter = createFilter("-trackers[].sitename", ["sassytorrents"])

    assert.equal(
      filter,
      `const values = ["sassytorrents"];
for (let it of obj.trackers) {
  if (values.some(val => val == it.sitename)) {
    return false
  }
}
return true
`
    )
  })
})
