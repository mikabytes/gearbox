import assert from "assert"
import Db from "./db.js"

describe("db", () => {
  let db

  beforeEach(() => {
    db = Db()

    db.set(1, { id: 1, name: "foo" })
    db.set(2, { id: 2, name: "bar" })
  })

  it(`should count`, () => {
    assert.equal(db.count(), 2)
  })

  it(`has`, () => {
    assert.equal(db.has(2), true)
    assert.equal(db.has(8), false)
  })

  it(`Should be able to get item by key`, () => {
    assert.deepEqual(db.get(1), { id: 1, name: "foo" })
  })

  it(`Should handle updates`, () => {
    assert.deepEqual(db.values(), [
      { id: 1, name: "foo" },
      { id: 2, name: "bar" },
    ])

    const item = db.update(1, { extra: `fun` })

    assert.deepEqual(item, { id: 1, name: "foo", extra: `fun` })

    assert.deepEqual(db.values(), [
      { id: 1, name: "foo", extra: `fun` },
      { id: 2, name: "bar" },
    ])
  })

  it(`Should sort when changing order after items added`, () => {
    db.sort((a, b) => {
      if (a.name > b.name) {
        return 1
      }
      if (a.name < b.name) {
        return -1
      }
      return 0
    })

    assert.deepEqual(db.values(), [
      { id: 2, name: "bar" },
      { id: 1, name: "foo" },
    ])
  })

  it(`Should keep sorting after adding more items`, () => {
    db.sort((a, b) => {
      if (a.name > b.name) {
        return 1
      }
      if (a.name < b.name) {
        return -1
      }
      return 0
    })

    db.set(3, { id: 3, name: `ant` })
    db.set(4, { id: 4, name: `bat` })

    assert.deepEqual(db.values(), [
      { id: 3, name: "ant" },
      { id: 2, name: "bar" },
      { id: 4, name: "bat" },
      { id: 1, name: "foo" },
    ])
  })

  it(`Should move items when their data is changed`, () => {
    db.sort((a, b) => {
      if (a.name > b.name) {
        return 1
      }
      if (a.name < b.name) {
        return -1
      }
      return 0
    })

    assert.deepEqual(db.values(), [
      { id: 2, name: "bar" },
      { id: 1, name: "foo" },
    ])

    db.update(1, { name: `aaa` })

    assert.deepEqual(db.values(), [
      { id: 1, name: "aaa" },
      { id: 2, name: "bar" },
    ])
  })

  it(`Should handle removal when several items have same sort order`, () => {
    db.sort((a, b) => {
      if (a.name > b.name) {
        return 1
      }
      if (a.name < b.name) {
        return -1
      }
      return 0
    })

    db.set(3, { id: 3, name: "cat" })
    db.set(4, { id: 4, name: "cat" })
    db.set(5, { id: 5, name: "cat" })

    assert.deepEqual(db.values(), [
      { id: 2, name: "bar" },
      { id: 3, name: "cat" },
      { id: 4, name: "cat" },
      { id: 5, name: "cat" },
      { id: 1, name: "foo" },
    ])

    db.remove(4)

    assert.deepEqual(db.values(), [
      { id: 2, name: "bar" },
      { id: 3, name: "cat" },
      { id: 5, name: "cat" },
      { id: 1, name: "foo" },
    ])

    assert.throws(() => db.get(4))
  })
})
