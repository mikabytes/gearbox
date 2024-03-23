export function filtersToStr(filters) {
  const parts = []

  for (const key of Object.keys(filters)) {
    if (key === `_text`) {
      continue
    }

    const values = filters[key]

    if (values?.length === 0) {
      continue
    }

    if (values.length === 1) {
      parts.push(`${key}:${stringify(values[0])}`)
    } else {
      parts.push(`${key}:(${values.map(stringify).join(` `)})`)
    }
  }

  if (filters._text?.length > 0) {
    for (const val of filters._text) {
      parts.push(`${stringify(val)}`)
    }
  }

  return parts.join(` `)
}

function stringify(val) {
  if (`${val}`.indexOf(` `) !== -1) {
    return `"${val}"`
  }
  return val
}

export function strToFilters(str) {
  const filters = {}

  const parts = str.matchAll(/([.a-zA-Z\[\]]+):(\(.*?\)|".*?"|[^\s]+)/g)

  for (const [all, key, value] of parts) {
    str = str.replaceAll(all, ``)
    filters[key] = [...value.matchAll(/(".+?"|\w+)/g)].map(([val]) =>
      unquote(val)
    )
  }

  str = str.trim()

  if (str) {
    filters._text = [...str.matchAll(/(".+?"|\w+)/g)]
      .map(([val]) => unquote(val))
      .filter((it) => !!it)
  }

  return filters
}

function unquote(val) {
  if (val.startsWith(`"`) && val.endsWith(`"`)) {
    return val.slice(1, -1)
  }
  return val
}
