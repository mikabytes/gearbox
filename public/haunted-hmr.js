import { component, html, useEffect, useState, useLayoutEffect } from "haunted"

const callbacks = []
export function onChange(path, module) {
  let didUse = false
  for (const callback of callbacks) {
    didUse ||= callback(path, module)
  }
  return didUse
}

export default function hot(component) {
  const mePath = getCallerFile()

  function ret(...args) {
    const [version, setVersion] = useState(0)

    useEffect(() => {
      function reload(path, newComponent) {
        console.log(path, mePath)
        if (path === mePath) {
          component = newComponent
          setVersion(version + 1)
          return true
        }
      }

      callbacks.push(reload)

      return () => {
        targets.splice(targets.indexOf(reload, 1))
      }
    }, [])

    try {
      console.log(component)
      return component.apply(this, args)
    } catch (e) {
      console.error(e)
      return formatError(e)
    }
  }

  Object.defineProperty(ret, `name`, { value: `hot(${component.name})` })
  return ret
}

function getCallerFile() {
  const o = Error.prepareStackTrace

  try {
    let callerfile
    let currentfile

    Error.prepareStackTrace = function (err, stack) {
      return stack
    }

    const err = new Error()
    const stack = err.stack

    stack.shift()
    stack.shift()
    stack.shift()

    const realCaller = err.stack
      .shift()
      .getFileName()
      .slice(document.location.origin.length + 1)

    return realCaller
  } catch (err) {
    /* do nothing */
  } finally {
    Error.prepareStackTrace = o
  }
  return undefined
}
function formatError(e) {
  const stacktrace = e.stack.map
    ? e.stack.map((it) => it.toString()).join(`\n`)
    : e.stack

  const message = `${e.message}\n\n${stacktrace.replace(/http:\/\/.*?\//g, ``)}`
  return html` <div
    style="border: 3px dashed red; color: red; font-size: 16px;padding: 8px; min-width: 30px; min-height: 30px; overflow: auto;"
  >
    <pre>${message}</pre>
  </div>`
}
