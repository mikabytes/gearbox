export default function Requester(host, { user, password } = {}) {
  let header = ``
  const base64Credentials = btoa(`${user}:${password}`)

  return async function request(method, args) {
    const url = `http://${host}/transmission/rpc`

    const body = { method, arguments: args }

    const options = {
      method: "POST",
      headers: {
        "Content-Type": `application/json`,
        Authorization: `Basic ${base64Credentials}`,
        "X-Transmission-Session-Id": header,
      },
      body: JSON.stringify(body),
    }

    const response = await fetch(url, options)

    if (response.status === 409) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      header = response.headers.get(`X-Transmission-Session-Id`)

      return request(method, args)
    }

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${await response.text()}`)
    }

    const json = await response.json()

    if (!json.result === `success`) {
      throw new Error(`Transmission error: ${json.result}`)
    }

    return json
  }
}
