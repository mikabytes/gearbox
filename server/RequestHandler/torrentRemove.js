import lookup from "../lookup.js"

export default async function torrentRemove(clients, args) {
  if (!Array.isArray(args.ids) || !args.ids.length) {
    throw new Error(`'ids' must be an array of at least one id to remove`)
  }

  for (const [client, torrents] of lookup(clients, args.ids)) {
    const resultArgs = await client.request(`torrent-remove`, {
      "delete-local-data": args["delete-local-data"],
      ids: [...torrents.map((t) => t.localId)],
    })

    if (resultArgs.result !== `success`) {
      throw new Error(`${clientId} returned an error: ${resultArgs.result}`)
    }
  }

  return {}
}
