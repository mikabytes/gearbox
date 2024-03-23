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
} from "haunted"

import { html, css } from "lit"

import useStyles from "./haunted-styles.js"

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
      useStyles(this, styles)
    }
    return target.apply(this, args)
  }

  customElements.define(tagName, hauntedComponent(Component))
}

export {
  component,
  html,
  css,
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
