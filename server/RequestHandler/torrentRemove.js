import byClient from "../byClient.js"

export default async function torrentRemove(clients, args) {
  if (!Array.isArray(args.ids) || !args.ids.length) {
    throw new Error(`'ids' must be an array of at least one id to remove`)
  }

  const split = byClient(clients, args.ids)

  for (const clientId of Object.keys(split)) {
    const client = clients.get(clientId)
    const resultArgs = await client.request(`torrent-remove`, {
      "delete-local-data": args["delete-local-data"],
      ids: split[clientId].map((id) => client.get(id).localId),
    })

    if (resultArgs.result !== `success`) {
      throw new Error(`${clientId} returned an error: ${resultArgs.result}`)
    }
  }

  return {}
}
