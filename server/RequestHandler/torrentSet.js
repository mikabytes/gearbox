import byClient from "../byClient.js"

export default async function torrentSet(clients, args) {
  const split = byClient(clients, args.ids)

  for (const clientId of Object.keys(split)) {
    const client = clients.get(clientId)
    const resultArgs = await client.request(`torrent-set`, {
      ...args,
      ids: split[clientId].map((id) => client.get(id).localId),
    })

    if (resultArgs.result !== `success`) {
      throw new Error(`${clientId} returned an error: ${resultArgs.result}`)
    }
  }

  return {}
}
