import defaultLogger from "../../logger.js"

export default function Requester(
  baseUrl,
  {
    user,
    password,
    fetch: fetchImpl = globalThis.fetch,
    logger = defaultLogger,
  } = {}
) {
  let header = ``
  const base64Credentials =
    user !== undefined || password !== undefined
      ? btoa(`${user || ``}:${password || ``}`)
      : null
  baseUrl = baseUrl.replace(/\/$/, ``)

  return async function request(method, args = {}, log = true) {
    const url = `${baseUrl}/transmission/rpc`

    const body = { method, arguments: args }

    const headers = {
      "Content-Type": `application/json`,
      "X-Transmission-Session-Id": header,
    }
    if (base64Credentials) {
      headers.Authorization = `Basic ${base64Credentials}`
    }

    const options = {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }

    const response = await fetchImpl(url, options)

    if (response.status === 409) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      header = response.headers.get(`X-Transmission-Session-Id`)

      return request(method, args, log)
    }

    if (log) {
      const logObj = { ...args }
      if (logObj.metainfo) {
        logObj.metainfo = `<base64>`
      }
      logger?.debug?.(
        `Subrequest to ${baseUrl}: ${method} ${JSON.stringify(logObj)}`
      )
    }

    if (!response.ok) {
      const errMsg = `HTTP error ${response.status}: ${await response.text()}`
      throw new Error(errMsg)
    }

    const json = await response.json()

    if (json.result !== `success`) {
      logger?.error?.(`Transmission error: ${json.result}`)
      throw new Error(`Transmission error: ${json.result}`)
    }

    if (log) {
      logger?.debug?.(`Subrequest response: ${JSON.stringify(json)}`)
    }

    return json
  }
}
