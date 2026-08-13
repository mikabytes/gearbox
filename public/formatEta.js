// Formats a Transmission-style eta (seconds; -1 = not available, -2 = unknown)
export default function formatEta(eta) {
  if (typeof eta !== `number` || !Number.isFinite(eta) || eta < 0) {
    return ``
  }

  const units = [
    [86400, `d`],
    [3600, `h`],
    [60, `m`],
    [1, `s`],
  ]

  const parts = []
  let rest = Math.floor(eta)
  for (const [size, suffix] of units) {
    const amount = Math.floor(rest / size)
    rest -= amount * size
    if (amount > 0 || (suffix === `s` && !parts.length)) {
      parts.push(`${amount}${suffix}`)
    }
    if (parts.length === 2) {
      break
    }
  }

  return parts.join(` `)
}
