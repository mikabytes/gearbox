// simple compiler for filters to speed things up
// expect filters on the form:
//
//   {
//     trackers[].sitename: ["foo", "bar"],
//     labels: ["sonarr", "radarr"]
//   },
//
// Meaning: tracker = (foo OR bar) AND label = (sonarr OR radarr)
//
// Whenever a key is an array, any of its values must match

export default function filterTorrents(filters) {
  const fieldFilters = removeSomeKeys(filters)
  const funcs = Object.keys(fieldFilters)
    .filter((key) => fieldFilters[key]?.length) // remove empty fields
    .map((key) => new Function(`obj`, createFilter(key, fieldFilters[key])))
  if (filters._text?.length) {
    funcs.push(textFilter(filters._text))
  }
  return (torrent) => funcs.every((func) => func(torrent))
}

export function createFilter(path, values) {
  const isNegated = path[0] === `-`
  if (isNegated) {
    path = path.slice(1)
  }

  const parts = `.${path}`.split("[]")
  const lastPart = parts.pop()
  const noLoops = parts.length === 0

  let code = `const values = ${JSON.stringify(values)};\n`

  parts.forEach((part, index) => {
    code += `${`  `.repeat(index)}for (let it of ${index === 0 ? `obj` : `it`}${part}) {\n`
  })

  // note that == here is important so we can compare strings with numbers
  code += `${`  `.repeat(parts.length)}if (values.some(val => val == ${noLoops ? `obj` : `it`}${lastPart})) {\n`
  code += `${`  `.repeat(parts.length)}  return ${isNegated ? `false` : `true`}\n`
  code += `${`  `.repeat(parts.length)}}\n`

  for (let i = parts.length - 1; i >= 0; i--) {
    code += `${`  `.repeat(i)}}\n`
  }

  if (isNegated) {
    code += `return true\n`
  }

  return code
}

function removeSomeKeys(filters) {
  const ret = { ...filters }
  const keys = Object.keys(ret)

  for (const key of keys) {
    if (key[0] === `-`) {
      continue
    }

    // if we have two filters that oppose eachother,
    // then we remove them as they are impossible to match.
    // This serves a purpose when using implicit filters to
    // unhide secrets..
    const negatedKey = `-${key}`
    if (keys.includes(negatedKey)) {
      // delete both
      delete ret[key]
      delete ret[negatedKey]
    }

    // any key that starts with underscore is not a field
    // filter, so they make no sense here
    if (key[0] === `_`) {
      delete ret[key]
    }
  }

  return ret
}

function textFilter(texts) {
  texts = texts.map((it) => it.toLowerCase())
  return (torrent) => texts.every((t) => torrent.search.includes(t))
}
