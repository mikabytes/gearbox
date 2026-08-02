import { assertConnector } from "./contract.js"

export default function ClientManager({
  clientConfigs,
  implementations,
  dependencies,
  logger,
  retryDelay = 5000,
  maximumRetryDelay = 60000,
  schedule = setTimeout,
}) {
  const clients = new Map()
  const status = new Map()
  const retries = new Map()

  for (const config of clientConfigs) {
    status.set(config.id, {
      id: config.id,
      type: config.type,
      state: `pending`,
      error: null,
      capabilities: {},
    })
  }

  async function start() {
    await Promise.all(clientConfigs.map((config) => connect(config)))
    return clients
  }

  async function connect(config, { announce = false } = {}) {
    const Client = implementations[config.type]
    if (!Client) {
      update(config, `error`, `Unknown connector type "${config.type}"`)
      return
    }

    update(config, `connecting`)
    try {
      const connector = assertConnector(
        await Client(config, {
          ...dependencies,
          reportStatus(state, error) {
            update(config, state, error)
            const connected = clients.get(config.id)
            if (connected) connected.available = state === `online`
          },
        }),
        { id: config.id, type: config.type }
      )
      connector.available = true
      clients.set(config.id, connector)
      retries.delete(config.id)
      update(config, `online`, null, connector.capabilities)
      if (announce) {
        for (const torrent of connector.getAll()) {
          dependencies.changes?.({ id: torrent.id, changeSet: torrent })
        }
      }
    } catch (error) {
      const connector = clients.get(config.id)
      if (connector) connector.available = false
      update(config, `offline`, error.message)
      logger.error(`Failed to connect ${config.id}: ${error.message}`)
      scheduleRetry(config)
    }
  }

  function scheduleRetry(config) {
    const attempt = (retries.get(config.id)?.attempt || 0) + 1
    const delay = Math.min(retryDelay * 2 ** (attempt - 1), maximumRetryDelay)
    const timer = schedule(() => connect(config, { announce: true }), delay)
    retries.set(config.id, { attempt, timer })
  }

  function update(config, state, error = null, connectorCapabilities) {
    const previous = status.get(config.id) || {}
    status.set(config.id, {
      ...previous,
      id: config.id,
      type: config.type,
      state,
      error: error ? `${error}` : null,
      capabilities: connectorCapabilities || previous.capabilities || {},
    })
  }

  function publicClients() {
    return clientConfigs.map((config) => {
      const current = status.get(config.id)
      return {
        id: config.id,
        type: config.type,
        maxCount: config.maxCount,
        state: current.state,
        error: current.error,
        capabilities: current.capabilities,
      }
    })
  }

  return { clients, publicClients, start, status }
}
