import lookup from "../lookup.js"

export default async function generic(clients, args, method) {
  const ret = {}

  for (const [client, torrents] of lookup(clients, args.ids)) {
    const resultArgs = await client.request(method, {
      ...args,
      ids: [...torrents.map((t) => t.localId)],
    })

    if (resultArgs.result !== `success`) {
      throw new Error(`${clientId} returned an error: ${resultArgs.result}`)
    }

    Object.assign(ret, resultArgs.arguments)
  }

  return ret
}
