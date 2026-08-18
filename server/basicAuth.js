import crypto from "crypto"

// Hashing both sides gives timingSafeEqual equal-length inputs, so the
// comparison stays constant-time regardless of what the client sends.
function fingerprint(value) {
  return crypto.createHash(`sha256`).update(value).digest()
}

function decodeCredentials(header) {
  if (typeof header !== `string`) return

  // Authentication schemes are case-insensitive and RFC 9110 permits one or
  // more spaces before the credentials. Basic credentials use canonical
  // RFC 4648 base64, so reject malformed input rather than relying on Node's
  // intentionally forgiving decoder.
  const match = /^Basic +([A-Za-z0-9+/]+={0,2})$/i.exec(header)
  if (!match || match[1].length % 4 !== 0) return

  const encoded = match[1]
  const decoded = Buffer.from(encoded, `base64`)
  if (decoded.toString(`base64`) !== encoded) return

  return decoded
}

export default function basicAuth({ username, password }) {
  const expected = fingerprint(`${username}:${password}`)

  return function (req, res, next) {
    const received = decodeCredentials(req.headers.authorization)

    if (received) {
      if (crypto.timingSafeEqual(fingerprint(received), expected)) {
        return next()
      }
    }

    res
      .set(`WWW-Authenticate`, `Basic realm="Gearbox", charset="UTF-8"`)
      .status(401)
      .send(`Authentication required`)
  }
}
