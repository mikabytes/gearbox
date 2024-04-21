// kind of catch-all for simple methods that pass an ids array
import lookup from "../lookup.js"

export default async function genericIds(clients, method, args) {
  for (const [client, torrents] of lookup(clients, args.ids)) {
    const resultArgs = await client.request(method, {
      ...args,
      ids: [...torrents.map((t) => t.localId)],
    })

    if (resultArgs.result !== `success`) {
      throw new Error(`${clientId} returned an error: ${resultArgs.result}`)
    }
  }

  return {}
}
