import logger from "../../logger.js"

export default function Requester(host, { user, password } = {}) {
  let header = ``
  const base64Credentials = btoa(`${user}:${password}`)

  return async function request(method, args, log = true) {
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

      return request(method, args, log)
    }

    if (log) {
      logger.debug(`Subrequest to ${host}: ${method} ${JSON.stringify(args)}`)
    }

    if (!response.ok) {
      const errMsg = `HTTP error ${response.status}: ${await response.text()}`
      throw new Error(errMsg)
    }

    const json = await response.json()

    if (!json.result === `success`) {
      logger.error(`Transmission error: ${json.result}`)
      throw new Error(`Transmission error: ${json.result}`)
    }

    if (log) {
      logger.debug(`Subrequest response: ${JSON.stringify(json)}`)
    }

    return json
  }
}
