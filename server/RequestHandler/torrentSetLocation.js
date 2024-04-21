import lookup from "../lookup.js"

export default async function torrentSetLocation(clients, args) {
  for (const [client, torrents] of lookup(clients, args.ids)) {
    const resultArgs = await client.request(`torrent-set-location`, {
      location: args.location,
      move: args.move,
      ids: [...torrents.map((t) => t.localId)],
    })

    if (resultArgs.result !== `success`) {
      throw new Error(`${clientId} returned an error: ${resultArgs.result}`)
    }
  }

  return {}
}
