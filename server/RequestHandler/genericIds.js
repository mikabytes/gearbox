import byClient from "../byClient.js"

// kind of catch-all for simple methods that pass an ids array
export default async function genericIds(clients, method, args) {
  const split = byClient(clients, args.ids)
  for (const clientId of Object.keys(split)) {
    const resultArgs = await clients.get(clientId).request(method, {
      ...args,
      ids: split[clientId].map((id) => clients.get(clientId).get(id).localId),
    })

    if (resultArgs.result !== `success`) {
      throw new Error(`${clientId} returned an error: ${resultArgs.result}`)
    }
  }

  return {}
}
