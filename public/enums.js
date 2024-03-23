// from https://github.com/transmission/transmission/blob/main/libtransmission/transmission.h

export const STOPPED = 0
export const CHECK_WAIT = 1
export const CHECK = 2
export const DOWNLOAD_WAIT = 3
export const DOWNLOAD = 4
export const SEED_WAIT = 5
export const SEED = 6

export function friendlyName(status) {
  switch (status) {
    case STOPPED:
      return "Paused"
    case CHECK_WAIT:
      return "Checking (queued)"
    case CHECK:
      return "Checking"
    case DOWNLOAD_WAIT:
      return "Downloading (queued)"
    case DOWNLOAD:
      return "Downloading"
    case SEED_WAIT:
      return "Seeding (queued)"
    case SEED:
      return "Seeding"
    default:
      return "Unknown"
  }
}
