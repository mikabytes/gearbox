export function isId(thing) {
  const isNumber = typeof thing === "number"
  const isInteger = Number.isInteger(thing)
  const isPositive = thing > 0

  return isNumber && isInteger && isPositive
}

export function isSHA1Hash(value) {
  return /^[a-f0-9]{40}$/i.test(value)
}
