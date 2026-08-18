import assert from "assert"
import { fileLevel, levelArguments } from "./filePriorities.js"

describe(`file priorities`, () => {
  it(`derives the level from a file stat`, () => {
    assert.equal(fileLevel({ wanted: false, priority: 1 }), `skip`)
    assert.equal(fileLevel({ wanted: true, priority: -1 }), `low`)
    assert.equal(fileLevel({ wanted: true, priority: 0 }), `normal`)
    assert.equal(fileLevel({ wanted: true, priority: 1 }), `high`)
    assert.equal(fileLevel(undefined), `normal`)
  })

  it(`builds torrent-set arguments for each level`, () => {
    assert.deepEqual(levelArguments(`skip`, 3), { "files-unwanted": [3] })
    assert.deepEqual(levelArguments(`low`, 0), {
      "files-wanted": [0],
      "priority-low": [0],
    })
    assert.deepEqual(levelArguments(`normal`, 1), {
      "files-wanted": [1],
      "priority-normal": [1],
    })
    assert.deepEqual(levelArguments(`high`, 2), {
      "files-wanted": [2],
      "priority-high": [2],
    })
  })
})
