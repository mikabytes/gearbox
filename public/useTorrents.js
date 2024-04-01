import { useState, useEffect } from "./component.js"
import Db from "./db.js"
import forEachLine from "./forEachLine.js"

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
    try {
      db.remove(id)
    } catch (e) {
      // ignore remove errors, they are definitely gone
    }
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
    item.files?.map((it) => it.name).join(` `)
  ).toLowerCase()
}

async function* start() {
  const source = new EventSource(`/stream`)
  let pauseMessages = []

  source.onmessage = (message) => {
    const payload = JSON.parse(message.data)

    if (payload.incr !== incr) {
      // we have missed a message, must reload to get to a fresh state
      document.location.reload()
      return
    }

    incr++

    if (pauseMessages) {
      // while we do the initial loading, we need to wait for all messages to arrive
      pauseMessages.push(payload)
    } else {
      onMessage(payload)
    }
  }
  source.onerror = (err) => {
    console.error("EventSource failed:", err)
  }

  const res = await fetch(`/all`)

  if (!res.ok) {
    alert(await res.text())
    return
  }

  const iterator = forEachLine(res.body.getReader())
  const firstLine = (await iterator.next()).value

  const { keys, total } = JSON.parse(firstLine)
  let finished = 0
  yield { finished, total }

  for await (const line of iterator) {
    const torrent = {}
    const values = JSON.parse(line)

    for (let i = 0; i < keys.length; i++) {
      torrent[keys[i]] = values[i]
    }
    addSearch(torrent)
    db.set(torrent.id, torrent)
    yield { finished: ++finished, total }
  }

  // now that we've transfered all the data, we can start streaming
  while (pauseMessages.length) {
    const payload = pauseMessages.shift()
    onMessage(payload)
  }
  pauseMessages = null
}

let didStart = false
export default function useTorrents() {
  const [isLoading, setIsLoading] = useState({})
  if (!didStart) {
    ;(async function () {
      didStart = true
      let finished = 0
      let total = 0
      // update ui every 10ms
      const timer = setInterval(() => {
        setIsLoading({ finished, total })
      }, 15)
      for await (const update of start()) {
        finished = update.finished
        total = update.total
      }
      clearInterval(timer)
      setIsLoading(false)
    })()
  }
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

  return [db, isLoading]
}
