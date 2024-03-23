import assert from "assert"
import { strToFilters } from "./filterStrLib.js"

describe("filterStrLib", () => {
  describe("strToFilters", () => {
    it("should parse simple filters", () => {
      const input = `status:6 clientId:sofa trackers[].sitename:torrentleech labels[]:sonarr`

      const expectedOutput = {
        status: ["6"],
        clientId: ["sofa"],
        "trackers[].sitename": ["torrentleech"],
        "labels[]": ["sonarr"],
      }

      assert.deepEqual(strToFilters(input), expectedOutput)
    })

    it("should parse OR statements", () => {
      const input = `status:(6 7)`

      const expectedOutput = {
        status: ["6", "7"],
      }

      assert.deepEqual(strToFilters(input), expectedOutput)
    })

    it("should parse quotes", () => {
      const input = `name:"foo bar" multi:("foo bar" baz "qux")`

      const expectedOutput = {
        name: ["foo bar"],
        multi: ["foo bar", "baz", "qux"],
      }

      assert.deepEqual(strToFilters(input), expectedOutput)
    })

    it("should include non-pairs as _text", () => {
      const input = `baz name:foo bar "humbo jumbo"`

      const expectedOutput = {
        name: ["foo"],
        _text: ["baz", "bar", "humbo jumbo"],
      }

      assert.deepEqual(strToFilters(input), expectedOutput)
    })
  })
})
