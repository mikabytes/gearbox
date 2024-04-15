export function decode(str) {
  let cursor = 0

  function parseInteger() {
    const end = str.indexOf("e", cursor)
    const num = parseInt(str.substring(cursor + 1, end), 10)
    cursor = end + 1
    return num
  }

  function parseString() {
    const colon = str.indexOf(":", cursor)
    const length = parseInt(str.substring(cursor, colon), 10)
    const start = colon + 1
    const end = start + length
    const result = str.substring(start, end)
    cursor = end
    return result
  }

  function parseList() {
    const list = []
    cursor++ // skip 'l'
    while (str[cursor] !== "e") {
      list.push(parseValue())
    }
    cursor++ // skip 'e'
    return list
  }

  function parseDictionary() {
    const dict = {}
    cursor++ // skip 'd'
    while (str[cursor] !== "e") {
      const key = parseString()
      const value = parseValue()
      dict[key] = value
    }
    cursor++ // skip 'e'
    return dict
  }

  function parseValue() {
    if (str[cursor] === "i") {
      return parseInteger()
    } else if (str[cursor] === "l") {
      return parseList()
    } else if (str[cursor] === "d") {
      return parseDictionary()
    } else if (!isNaN(str[cursor])) {
      return parseString()
    } else {
      throw new Error(`Unknown type at position ${cursor}`)
    }
  }

  return parseValue()
}
