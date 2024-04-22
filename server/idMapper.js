import state from "./state.js"

export function strToInt(clientId) {
  const key = `id.${clientId}`
  if (state[key]) {
    return state[key]
  }

  if (!state.next) {
    state.next = 1
  }

  state[key] = state.next++
  return state[key]
}

export function intToStr(int) {
  for (const key of Object.keys(state)) {
    if (key.startsWith(`id.`) && state[key] === int) {
      return key.slice(3)
    }
  }
}
