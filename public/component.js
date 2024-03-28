import {
  component as hauntedComponent,
  useCallback,
  useContext,
  useController,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "https://cdn.jsdelivr.net/npm/haunted@5.0.0/+esm"

import { html } from "lit-html"
import hmr from "./haunted-hmr.js"

window._modules ||= {}

export async function css(path) {
  const absPath = path

  path = path.slice(document.location.origin.length + 1)

  const ss = new CSSStyleSheet()
  ss.replaceSync(await fetch(absPath).then((m) => m.text()))

  const module = (window._modules[path] ||= {
    instances: [],
    css: ss,
  })

  return (cb) => {
    cb(module.css)
    module.instances.push(cb)

    return () => {
      module.instances.splice(module.instances.indexOf(cb), 1)
    }
  }
}

function component(...args) {
  let tagName, styles, target
  if (args.length === 3) {
    tagName = args[0]
    styles = args[1]
    target = args[2]
  } else {
    tagName = args[0]
    target = args[1]
  }

  function Component(...args) {
    if (styles) {
      useLayoutEffect(() => {
        if (typeof styles === "function") {
          return styles((css) => {
            this.shadowRoot.adoptedStyleSheets = [css]
          })
        } else {
          this.shadowRoot.adoptedStyleSheets = [
            styles instanceof CSSStyleSheet ? styles : styles.styleSheet,
          ]
        }
      }, [])
    }

    // for HMR
    useEffect(() => {
      const entry = window._modules[tagName]
      entry.instances.push(this)
      return () => {
        entry.instances.splice(entry.instances.indexOf(this), 1)
      }
    }, [])

    return window._modules[tagName].target.apply(this, args)
  }

  if (!customElements.get(tagName)) {
    window._modules[tagName] = { target, instances: [] }
    customElements.define(tagName, hauntedComponent(Component))
  } else {
    window._modules[tagName].target = target
    window._modules[tagName].instances.forEach((instance) =>
      instance._scheduler.update()
    )
  }
}

let counter = 0

// hot-reload script
const source = new EventSource(`/changes`)
source.onmessage = async (message) => {
  let { path, exists } = JSON.parse(message.data)

  path = path.replace(/^.*?\//, ``)

  let module

  if (!exists) {
    console.log(`${path} was deleted!`)
  } else {
    console.log(`${path} was modified.`)
    let newModule

    if (path.endsWith(`.css`)) {
      newModule = new CSSStyleSheet()
      newModule.replaceSync(
        await fetch(`/public/${path}?${counter++}`).then((m) => m.text())
      )
    } else {
      newModule = (await import(`/public/${path}?${counter++}`)).default
    }

    const c = window._modules[path]
    if (c?.css) {
      c.css = newModule
      c.instances.forEach((instance) => instance(c.css))
    }
  }

  if (!exists) {
    // just reload if a file was removed, we can't hot reload that
    document.location.reload()
  }
}

//function getCallerFile() {
//  const o = Error.prepareStackTrace
//
//  try {
//    let callerfile
//    let currentfile
//
//    Error.prepareStackTrace = function (err, stack) {
//      return stack
//    }
//
//    const err = new Error()
//    const stack = err.stack
//
//    stack.shift()
//    stack.shift()
//
//    const realCaller = err.stack
//      .shift()
//      .getFileName()
//      .slice(document.location.origin.length + 1)
//
//    return realCaller
//  } catch (err) {
//    /* do nothing */
//  } finally {
//    Error.prepareStackTrace = o
//  }
//  return undefined
//}

export {
  component,
  html,
  useCallback,
  useContext,
  useController,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
}
