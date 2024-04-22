import { writeFile, readFile } from "fs/promises"

import logger from "./logger.js"

const state = {}
let path

const handler = {
  set(target, prop, value) {
    if (!path) {
      throw new Error(`State has not been loaded yet.`)
    }
    logger.debug(`Setting state "${prop}" to ${JSON.stringify(value)}`)
    target[prop] = value
    const json = JSON.stringify(target)
    writeFile(path, json).catch(console.error)
    return true
  },
}

export default new Proxy(state, handler)

export async function load(newPath) {
  path = newPath

  logger.debug(`Loading state from "${path}"`)

  try {
    const content = await readFile(path, `utf8`)
    const json = JSON.parse(content)
    Object.assign(state, json)
  } catch (e) {
    if (e.code !== `ENOENT`) {
      logger.debug(`No state found at "${path}"`)
      throw e
    }
  }
}
