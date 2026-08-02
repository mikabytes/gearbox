import { createHash } from "crypto"

export function metainfoHashes(metainfo) {
  const data = Buffer.isBuffer(metainfo)
    ? metainfo
    : Buffer.from(metainfo, `base64`)
  const info = findInfoDictionary(data)
  const type = inspectInfoDictionary(info)
  const hashes = []

  // BitTorrent clients use the v1 hash as the primary identity for hybrids.
  if (type.hasV1 || type.metaVersion !== 2) {
    hashes.push(createHash(`sha1`).update(info).digest(`hex`))
  }
  if (type.metaVersion === 2) {
    hashes.push(createHash(`sha256`).update(info).digest(`hex`))
  }

  return hashes
}

export function magnetHashes(magnet) {
  let url
  try {
    url = new URL(magnet)
  } catch {
    throw new Error(`Invalid magnet URI`)
  }
  if (url.protocol !== `magnet:`) throw new Error(`Invalid magnet URI`)

  const hashes = []
  for (const exactTopic of url.searchParams.getAll(`xt`)) {
    const lower = exactTopic.toLowerCase()
    if (lower.startsWith(`urn:btih:`)) {
      const value = exactTopic.slice(9)
      if (/^[a-f0-9]{40}$/i.test(value)) {
        hashes.push(value.toLowerCase())
      } else if (/^[a-z2-7]{32}$/i.test(value)) {
        hashes.push(base32ToHex(value))
      }
    } else if (lower.startsWith(`urn:btmh:1220`)) {
      const value = exactTopic.slice(13)
      if (/^[a-f0-9]{64}$/i.test(value)) hashes.push(value.toLowerCase())
    }
  }

  const unique = [...new Set(hashes)]
  if (!unique.length) throw new Error(`Magnet URI has no supported BitTorrent hash`)
  return unique
}

function findInfoDictionary(data) {
  if (data[0] !== 0x64) throw new Error(`Invalid torrent metainfo`)

  let cursor = 1
  while (cursor < data.length && data[cursor] !== 0x65) {
    const key = readString(data, cursor)
    cursor = key.end
    const valueStart = cursor
    cursor = skipValue(data, cursor)
    if (key.value === `info`) return data.subarray(valueStart, cursor)
  }

  throw new Error(`Torrent metainfo has no info dictionary`)
}

function inspectInfoDictionary(info) {
  if (info[0] !== 0x64) throw new Error(`Invalid torrent info dictionary`)

  let cursor = 1
  let hasV1 = false
  let metaVersion
  while (cursor < info.length && info[cursor] !== 0x65) {
    const key = readString(info, cursor)
    cursor = key.end
    if (key.value === `pieces`) hasV1 = true
    if (key.value === `meta version`) {
      const integer = readInteger(info, cursor)
      metaVersion = integer.value
      cursor = integer.end
    } else {
      cursor = skipValue(info, cursor)
    }
  }
  return { hasV1, metaVersion }
}

function skipValue(data, cursor) {
  const byte = data[cursor]
  if (byte === 0x69) return readInteger(data, cursor).end
  if (byte >= 0x30 && byte <= 0x39) return readString(data, cursor).end
  if (byte !== 0x6c && byte !== 0x64) {
    throw new Error(`Invalid bencode value at byte ${cursor}`)
  }

  const dictionary = byte === 0x64
  cursor++
  while (data[cursor] !== 0x65) {
    if (cursor >= data.length) throw new Error(`Unterminated bencode value`)
    if (dictionary) cursor = readString(data, cursor).end
    cursor = skipValue(data, cursor)
  }
  return cursor + 1
}

function readString(data, cursor) {
  const colon = data.indexOf(0x3a, cursor)
  if (colon < 0) throw new Error(`Invalid bencode string at byte ${cursor}`)
  const lengthText = data.toString(`ascii`, cursor, colon)
  if (!/^\d+$/.test(lengthText)) {
    throw new Error(`Invalid bencode string length at byte ${cursor}`)
  }
  const start = colon + 1
  const end = start + Number(lengthText)
  if (end > data.length) throw new Error(`Truncated bencode string`)
  return { value: data.toString(`utf8`, start, end), end }
}

function readInteger(data, cursor) {
  if (data[cursor] !== 0x69) throw new Error(`Invalid bencode integer`)
  const endMarker = data.indexOf(0x65, cursor + 1)
  if (endMarker < 0) throw new Error(`Unterminated bencode integer`)
  const value = Number(data.toString(`ascii`, cursor + 1, endMarker))
  if (!Number.isSafeInteger(value)) throw new Error(`Invalid bencode integer`)
  return { value, end: endMarker + 1 }
}

function base32ToHex(value) {
  const alphabet = `ABCDEFGHIJKLMNOPQRSTUVWXYZ234567`
  let bits = ``
  for (const character of value.toUpperCase()) {
    bits += alphabet.indexOf(character).toString(2).padStart(5, `0`)
  }

  const bytes = []
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(parseInt(bits.slice(offset, offset + 8), 2))
  }
  return Buffer.from(bytes).toString(`hex`)
}
