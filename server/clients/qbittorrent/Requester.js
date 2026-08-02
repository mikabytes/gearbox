export default function Requester(
  baseUrl,
  { username, password, fetch: fetchImpl, logger } = {}
) {
  if (typeof fetchImpl !== `function`) {
    throw new Error(`qBittorrent connector requires an injected fetch function`)
  }

  baseUrl = baseUrl.replace(/\/$/, ``)
  const origin = new URL(baseUrl).origin
  let cookie = ``
  let loginPromise

  async function login() {
    if (loginPromise) return loginPromise

    loginPromise = (async () => {
      const body = formBody({ username, password })
      const response = await fetchImpl(`${baseUrl}/api/v2/auth/login`, {
        method: `POST`,
        headers: {
          "Content-Type": `application/x-www-form-urlencoded; charset=UTF-8`,
          Origin: origin,
          Referer: origin,
        },
        body,
      })
      const text = await response.text()
      if (!response.ok || text.trim() !== `Ok.`) {
        throw new Error(
          `qBittorrent login failed (${response.status}): ${text.trim() || `empty response`}`
        )
      }

      cookie = responseCookies(response).join(`; `)
      logger?.debug?.(`Authenticated with qBittorrent at ${baseUrl}`)
    })()

    try {
      await loginPromise
    } finally {
      loginPromise = undefined
    }
  }

  async function request(
    apiPath,
    { method = `GET`, params, body, responseType = `json`, retry = true } = {}
  ) {
    const url = new URL(`${baseUrl}/api/v2/${apiPath}`)
    if (params) appendParams(url.searchParams, params)

    const headers = {
      Origin: origin,
      Referer: origin,
    }
    if (cookie) headers.Cookie = cookie

    let requestBody = body
    if (body && !(body instanceof FormData)) {
      requestBody = formBody(body)
      headers["Content-Type"] =
        `application/x-www-form-urlencoded; charset=UTF-8`
    }

    const response = await fetchImpl(url, {
      method,
      headers,
      body: method === `GET` ? undefined : requestBody,
    })

    if (response.status === 403 && retry) {
      cookie = ``
      await login()
      return request(apiPath, {
        method,
        params,
        body,
        responseType,
        retry: false,
      })
    }

    if (!response.ok) {
      const message = await response.text()
      throw new Error(
        `qBittorrent ${apiPath} failed (${response.status}): ${message || response.statusText}`
      )
    }

    if (response.status === 204 || responseType === `none`) return undefined
    if (responseType === `text`) return response.text()
    return response.json()
  }

  return { login, request }
}

function formBody(values) {
  const ret = new URLSearchParams()
  appendParams(ret, values)
  return ret
}

function appendParams(target, values) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const item of value) target.append(key, `${item}`)
    } else {
      target.append(key, `${value}`)
    }
  }
}

function responseCookies(response) {
  const values = response.headers.getSetCookie?.() || []
  if (!values.length) {
    const combined = response.headers.get(`set-cookie`)
    if (combined) values.push(...combined.split(/,(?=\s*[^;,=\s]+=)/))
  }

  return values
    .map((value) => value.split(`;`, 1)[0].trim())
    .filter(Boolean)
}
