export class DelugeRpcError extends Error {
  constructor(message, { code, method } = {}) {
    super(message)
    this.name = `DelugeRpcError`
    this.code = code
    this.method = method
  }
}

export default function Requester(url, { password, fetch, onRenew }) {
  if (typeof fetch !== `function`) {
    throw new Error(`Deluge connector requires an injected fetch function`)
  }

  const endpoint = `${url}`.replace(/\/$/, ``).replace(/\/json$/, ``) + `/json`
  let cookie = ``
  let requestId = 0
  let renewal

  async function raw(method, params = []) {
    const headers = {
      Accept: `application/json`,
      "Content-Type": `application/json`,
    }
    if (cookie) headers.Cookie = cookie

    const response = await fetch(endpoint, {
      method: `POST`,
      headers,
      body: JSON.stringify({ method, params, id: ++requestId }),
    })

    updateCookie(response?.headers)

    if (response?.ok === false || Number(response?.status) >= 400) {
      const body = await responseText(response)
      throw new DelugeRpcError(
        `Deluge HTTP request failed${response?.status ? ` (${response.status})` : ``}${body ? `: ${body}` : ``}`,
        { method }
      )
    }

    let body
    try {
      body = await responseJson(response)
    } catch (error) {
      throw new DelugeRpcError(
        `Deluge returned invalid JSON for ${method}: ${error.message}`,
        { method }
      )
    }

    if (body?.error) {
      throw new DelugeRpcError(
        `Deluge ${method} failed: ${body.error.message || JSON.stringify(body.error)}`,
        { code: body.error.code, method }
      )
    }

    return body?.result
  }

  async function login() {
    const loggedIn = await raw(`auth.login`, [password])
    if (!loggedIn) throw new Error(`Deluge Web password was rejected`)
  }

  async function request(method, params = []) {
    const requestCookie = cookie
    try {
      return await raw(method, params)
    } catch (error) {
      if (!isAuthenticationError(error) || method === `auth.login`) throw error

      // A concurrent request may already have renewed the session.
      if (cookie && cookie !== requestCookie) return raw(method, params)

      if (!renewal) {
        renewal = (async () => {
          await login()
          await onRenew?.()
        })().finally(() => {
          renewal = undefined
        })
      }
      await renewal
      return raw(method, params)
    }
  }

  function updateCookie(headers) {
    if (!headers) return
    const values =
      typeof headers.getSetCookie === `function`
        ? headers.getSetCookie()
        : [headers.get?.(`set-cookie`) || headers[`set-cookie`]]

    for (const value of values || []) {
      const match = `${value || ``}`.match(/(?:^|[,;]\s*)_session_id=([^;,\s]+)/i)
      if (match) cookie = `_session_id=${match[1]}`
    }
  }

  return {
    get cookie() {
      return cookie
    },
    login,
    raw,
    request,
  }
}

function isAuthenticationError(error) {
  return (
    error?.code === 1 ||
    /not authenticated|not authorized|not authorised|authentication required/i.test(
      error?.message || ``
    )
  )
}

async function responseJson(response) {
  if (typeof response?.json === `function`) return response.json()
  const text = await responseText(response)
  return JSON.parse(text)
}

async function responseText(response) {
  if (typeof response?.text === `function`) return response.text()
  return ``
}
