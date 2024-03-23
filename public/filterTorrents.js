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
  const funcs = Object.keys(filters)
    .filter((key) => filters[key]?.length) // remove empty filters
    .map((key) => new Function(`obj`, createFilter(key, filters[key])))
  return (torrent) => funcs.every((func) => func(torrent))
}

export function createFilter(path, values) {
  const parts = `.${path}`.split("[]")
  const lastPart = parts.pop()
  const noLoops = parts.length === 0

  let code = `const values = ${JSON.stringify(values)};\n`

  parts.forEach((part, index) => {
    code += `${`  `.repeat(index)}for (let it of ${index === 0 ? `obj` : `it`}${part}) {\n`
  })

  code += `${`  `.repeat(parts.length)}if (values.includes(${noLoops ? `obj` : `it`}${lastPart})) {\n`
  code += `${`  `.repeat(parts.length)}  return true\n`
  code += `${`  `.repeat(parts.length)}}\n`

  for (let i = parts.length - 1; i >= 0; i--) {
    code += `${`  `.repeat(i)}}\n`
  }

  return code
}
