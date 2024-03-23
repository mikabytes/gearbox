import { useState, useEffect } from "./component.js"
import Db from "./db.js"

let incr = 0

const db = (window.db = Db())

db.sort((a, b) => {
  if (a.addedDate > b.addedDate) {
    return -1
  }
  if (a.addedDate < b.addedDate) {
    return 1
  }
  return 0
})

async function onMessage({ id, isRemoved, changeSet }) {
  if (isRemoved) {
    db.remove(id)
    return
  }

  if (db.has(id)) {
    db.update(id, changeSet)
    const item = db.get(id)
    addSearch(item)
  } else {
    addSearch(changeSet)
    db.set(id, changeSet)
  }
}

function addSearch(item) {
  item.search = (
    item.name +
    ` ` +
    item[`primary-mime-type`] +
    ` ` +
    item.files.map((it) => it.name).join(` `)
  ).toLowerCase()
}

const source = new EventSource(`/stream`)
source.onmessage = (message) => {
  const payload = JSON.parse(message.data)

  if (payload.incr !== incr) {
    // we have missed a message, must reload to get to a fresh state
    document.location.reload()
    return
  }

  incr++

  onMessage(payload)
}
source.onerror = (err) => {
  didErr = true
  console.error("EventSource failed:", err)
}

export default function useTorrents() {
  // just a dummy to force re-render
  let [_, setIncr] = useState(incr)

  // debounce the callback, so we don't repaint UI too often
  useEffect(() => {
    let myIncr = 0
    let didChange = false
    let timer = setTimeout(checkIncr, 10)

    function checkIncr() {
      if (myIncr !== incr) {
        didChange = true
        myIncr = incr
      } else if (didChange) {
        didChange = false
        setIncr(incr)
      }
      timer = setTimeout(checkIncr, 10)
    }

    return () => {
      clearTimeout(timer)
    }
  }, [])

  return [db]
}
