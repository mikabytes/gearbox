export const capabilityNames = [
  `addTorrent`,
  `removeTorrents`,
  `setTorrents`,
  `setLocation`,
  `startTorrents`,
  `startTorrentsNow`,
  `stopTorrents`,
  `verifyTorrents`,
  `reannounceTorrents`,
  `renameTorrentPath`,
  `moveQueue`,
  `sessionGet`,
  `transfer`,
]

const requiredMethods = [`count`, `get`, `getAll`, `getRecent`]

export function capabilities(overrides = {}) {
  return Object.fromEntries(
    capabilityNames.map((name) => [name, overrides[name] === true])
  )
}

export function assertConnector(connector, expected = {}) {
  if (!connector || typeof connector !== `object`) {
    throw new Error(`Connector factory did not return an object`)
  }

  if (!connector.id || typeof connector.id !== `string`) {
    throw new Error(`Connector id must be a non-empty string`)
  }

  if (expected.id && connector.id !== expected.id) {
    throw new Error(
      `Connector returned id "${connector.id}", expected "${expected.id}"`
    )
  }

  if (!connector.type || typeof connector.type !== `string`) {
    throw new Error(`Connector "${connector.id}" must declare its type`)
  }
  if (expected.type && connector.type !== expected.type) {
    throw new Error(
      `Connector "${connector.id}" returned type "${connector.type}", expected "${expected.type}"`
    )
  }

  for (const method of requiredMethods) {
    if (typeof connector[method] !== `function`) {
      throw new Error(`Connector "${connector.id}" is missing ${method}()`)
    }
  }

  connector.capabilities = capabilities(connector.capabilities)

  for (const capability of capabilityNames) {
    if (
      connector.capabilities[capability] &&
      capability !== `transfer` &&
      typeof connector[capability] !== `function`
    ) {
      throw new Error(
        `Connector "${connector.id}" declares ${capability} but does not implement it`
      )
    }
  }

  return connector
}
