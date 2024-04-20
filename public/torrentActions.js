export async function add(args) {
  const res = await fetch(`/transmission/rpc`, {
    method: `POST`,
    headers: {
      "Content-Type": `application/json`,
    },
    body: JSON.stringify({
      method: `torrent-add`,
      arguments: args,
    }),
  })

  if (!res.ok) {
    console.error(res.status)
    alert(`Unexpected response: ${res.status}`)
    return res.status
  }

  const json = await res.json()
  if (!json.result === `success`) {
    console.error(json.result)
    alert(json.result)
    return json.result
  }
}

export async function verify(ids) {
  const res = await fetch(`/transmission/rpc`, {
    method: `POST`,
    headers: {
      "Content-Type": `application/json`,
    },
    body: JSON.stringify({
      method: `torrent-verify`,
      arguments: { ids },
    }),
  })

  if (!res.ok) {
    console.error(res.status)
    alert(`Unexpected response: ${res.status}`)
    return res.status
  }

  const json = await res.json()
  if (!json.result === `success`) {
    console.error(json.result)
    alert(json.result)
    return json.result
  }
}

export async function set(ids, fields) {
  if (!fields || Object.keys(fields).length === 0) {
    throw new Error(`fields is required`)
  }

  const res = await fetch(`/transmission/rpc`, {
    method: `POST`,
    headers: {
      "Content-Type": `application/json`,
    },
    body: JSON.stringify({
      method: `torrent-set`,
      arguments: { ids, ...fields },
    }),
  })

  if (!res.ok) {
    console.error(res.status)
    alert(`Unexpected response: ${res.status}`)
    return res.status
  }

  const json = await res.json()
  if (!json.result === `success`) {
    console.error(json.result)
    alert(json.result)
    return json.result
  }
}

export async function setLocation(ids, path) {
  const res = await fetch(`/transmission/rpc`, {
    method: `POST`,
    headers: {
      "Content-Type": `application/json`,
    },
    body: JSON.stringify({
      method: `torrent-set-location`,
      arguments: { ids, move: true, location: path },
    }),
  })

  if (!res.ok) {
    console.error(res.status)
    alert(`Unexpected response: ${res.status}`)
    return res.status
  }

  const json = await res.json()
  if (!json.result === `success`) {
    console.error(json.result)
    alert(json.result)
    return json.result
  }
}

export async function pause(ids) {
  const res = await fetch(`/transmission/rpc`, {
    method: `POST`,
    headers: {
      "Content-Type": `application/json`,
    },
    body: JSON.stringify({
      method: `torrent-stop`,
      arguments: { ids },
    }),
  })

  if (!res.ok) {
    console.error(res.status)
    alert(`Unexpected response: ${res.status}`)
    return res.status
  }

  const json = await res.json()
  if (!json.result === `success`) {
    console.error(json.result)
    alert(json.result)
    return json.result
  }
}

export async function resume(ids) {
  const res = await fetch(`/transmission/rpc`, {
    method: `POST`,
    headers: {
      "Content-Type": `application/json`,
    },
    body: JSON.stringify({
      method: `torrent-start`,
      arguments: { ids },
    }),
  })

  if (!res.ok) {
    console.error(res.status)
    alert(`Unexpected response: ${res.status}`)
    return res.status
  }

  const json = await res.json()
  if (!json.result === `success`) {
    console.error(json.result)
    alert(json.result)
    return json.result
  }
}

export async function remove(ids, deleteLocalFiles = false) {
  const res = await fetch(`/transmission/rpc`, {
    method: `POST`,
    headers: {
      "Content-Type": `application/json`,
    },
    body: JSON.stringify({
      method: `torrent-remove`,
      arguments: {
        ids,
        "delete-local-data": deleteLocalFiles,
      },
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    console.error(error)
    alert(error)
    return
  }
}
