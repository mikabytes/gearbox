// we are constrained to fit torrentId + clientId in a signed 32 bit integer
// This algorithm reserves 22 bits (4194303 numbers) for torrentId,
// and 9 bits (511 numbers) for clientId, skipping the 32nd bit to
// avoid negative numbers.

import { intToStr, strToInt } from "./idMapper.js"
import logger from "./logger.js"

export function encode({ clientId, torrentId }) {
    clientId = strToInt(clientId)
    if (clientId < 0 || clientId >= 512) {
        throw new Error("clientId must be between 0 and 511")
    }
    if (torrentId < 0 || torrentId >= 4194304) {
        throw new Error("torrentId must be between 0 and 4194303")
    }

    // Allocate 9 bits to clientId (shifted left by 22 bits)
    // Allocate 22 bits to torrentId
    const ret = (clientId << 22) | (torrentId & 0x3fffff)

    return ret
}

export function decode(guid) {
    // Retrieve torrentId using a bitmask for 22 bits
    const torrentId = guid & 0x3fffff
    // Right shift to drop the torrentId bits and retrieve clientId
    let clientId = guid >> 22

    clientId = intToStr(clientId)

    return { clientId, torrentId }
}
