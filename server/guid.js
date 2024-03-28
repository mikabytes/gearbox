// we are constrained to fit torrentId + clientId in a signed 32 bit integer
// This algorithm reserves low numbers for torrentId, and the rest for clientId
// using Base 37 encoding. We only allow a-z and 0-9 in the clientId

const highLimit = 900000

export function encode({ clientId, torrentId }) {
  if (
    !clientId?.length ||
    clientId.length > 6 ||
    !clientId.match(/^[a-z0-9]+$/)
  ) {
    throw new Error(
      `ID must be 1 to 6 characters long and contain only a-z and 0-9`
    )
  }
  let clientNum = 0
  for (const char of clientId) {
    let value =
      char >= "a" && char <= "z"
        ? char.charCodeAt(0) - 86
        : char.charCodeAt(0) - 47
    clientNum = clientNum * 37 + value
  }

  return torrentId + clientNum * highLimit
}

export function decode(guid) {
  const torrentId = guid % highLimit
  let clientNum = (guid - torrentId) / highLimit
  let clientId = ""

  while (clientNum > 0) {
    const value = clientNum % 37
    let char
    if (value < 11) {
      char = String.fromCharCode(value + 47)
    } else {
      char = String.fromCharCode(value + 86)
    }
    clientId = char + clientId
    clientNum = Math.floor(clientNum / 37)
  }

  return { clientId, torrentId }
}
