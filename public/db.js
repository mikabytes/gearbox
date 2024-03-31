// A sort of in-memory database that keeps torrents both sorted
// and accessible by key in a more efficient way.

export default function Db() {
  const db = new Map()
  const sorted = []

  // default sorting is on id
  let sortFunc = (a, b) => {
    if (a.id < b.id) {
      return -1
    }
    if (a.id > b.id) {
      return 1
    }
    return 0
  }

  function has(key) {
    return db.has(key)
  }

  function sortedIndex(newItem) {
    if (!newItem) {
      throw new Error(`newItem is required to be sorted`)
    }
    let low = 0
    let high = sorted.length

    while (low < high) {
      let mid = (low + high) >>> 1
      if (sortFunc(newItem, sorted[mid]) >= 0) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    return low
  }

  // more efficient on pre-sorted array than native indexOf
  function indexOf(item) {
    let index = sortedIndex(item)

    // we have to deal with case when several items are equal:
    while (index >= 0 && sorted[index] !== item) {
      index--
    }

    return index
  }

  const ret = {
    has,
    count() {
      return sorted.length
    },
    sort(newSortFunc) {
      sortFunc = newSortFunc
      sorted.sort(sortFunc)
    },
    set(key, item) {
      if (has(key)) {
        throw new Error(`key ${key} already exists`)
      }
      if (!item) {
        throw new Error(`item is required`)
      }
      db.set(key, item)
      const index = sortedIndex(item)
      sorted.splice(index, 0, item)
    },
    get(key) {
      if (!has(key)) {
        throw new Error(`key ${key} does not exist`)
      }
      return db.get(key)
    },
    update(key, changeSet) {
      const item = ret.get(key)
      ret.remove(key)

      // update
      const newItem = { ...item, ...changeSet }

      // put it back in
      ret.set(key, newItem)

      return newItem
    },
    remove(key) {
      if (!has(key)) {
        throw new Error(`key ${key} does not exist`)
      }
      const item = db.get(key)
      db.delete(key)
      const index = indexOf(item)
      if (index === -1) {
        throw new Error("torrent not found in presorted")
      }
      sorted.splice(index, 1)
    },
    values() {
      return sorted
    },
  }

  return ret
}
