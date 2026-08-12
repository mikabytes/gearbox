import crypto from "crypto"

// Hashing both sides gives timingSafeEqual equal-length inputs, so the
// comparison stays constant-time regardless of what the client sends.
function fingerprint(value) {
  return crypto.createHash(`sha256`).update(value).digest()
}

export default function basicAuth({ username, password }) {
  const expected = fingerprint(`${username}:${password}`)

  return function (req, res, next) {
    const header = req.headers.authorization ?? ``

    if (header.startsWith(`Basic `)) {
      const received = Buffer.from(header.slice(`Basic `.length), `base64`)
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
