import { createFilter } from "./filterTorrents.js"
import assert from "assert"

describe("filterTorrents", () => {
  it("should handle single field", () => {
    const filter = createFilter("name", ["baz"])

    assert.equal(
      filter,
      `const values = ["baz"];
if (values.includes(obj.name)) {
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
    if (values.includes(it.name)) {
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
    if (values.includes(it.name)) {
      return true
    }
  }
}
`
    )
  })
})
