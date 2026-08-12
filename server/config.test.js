import assert from "assert"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { pathToFileURL } from "url"
import { loadConfig } from "./config.js"

describe(`configuration`, () => {
  it(`normalizes legacy credentials and canonical URLs`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), `gearbox-config-`))
    try {
      const filename = path.join(root, `config.mjs`)
      await fs.writeFile(
        filename,
        `export default {
          clients: [{ id: "one", url: "http://localhost:9091/", user: "name" }]
        }`
      )

      const config = await loadConfig(
        `${pathToFileURL(filename).href}?test=${Date.now()}`,
        filename,
        root
      )

      assert.equal(config.clients[0].type, `transmission`)
      assert.equal(config.clients[0].url, `http://localhost:9091`)
      assert.equal(config.clients[0].username, `name`)
      assert.equal(config.clients[0].maxCount, -1)
    } finally {
      await fs.rm(root, { recursive: true })
    }
  })

  it(`rejects duplicate client identifiers`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), `gearbox-config-`))
    try {
      const filename = path.join(root, `config.mjs`)
      await fs.writeFile(
        filename,
        `export default { clients: [{ id: "same" }, { id: "same" }] }`
      )

      await assert.rejects(
        loadConfig(
          `${pathToFileURL(filename).href}?test=${Date.now()}`,
          filename,
          root
        ),
        /configured more than once/
      )
    } finally {
      await fs.rm(root, { recursive: true })
    }
  })

  it(`rejects client identifiers that cannot be encoded safely`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), `gearbox-config-`))
    try {
      const filename = path.join(root, `config.mjs`)
      await fs.writeFile(
        filename,
        `export default { clients: [{ id: "not_safe" }] }`
      )

      await assert.rejects(
        loadConfig(
          `${pathToFileURL(filename).href}?test=${Date.now()}`,
          filename,
          root
        ),
        /must contain only a-z and 0-9/
      )
    } finally {
      await fs.rm(root, { recursive: true })
    }
  })

  it(`accepts optional web UI credentials`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), `gearbox-config-`))
    try {
      const filename = path.join(root, `config.mjs`)
      await fs.writeFile(
        filename,
        `export default {
          clients: [{ id: "one" }],
          auth: { username: "admin", password: "secret" },
        }`
      )

      const config = await loadConfig(
        `${pathToFileURL(filename).href}?test=${Date.now()}`,
        filename,
        root
      )

      assert.equal(config.auth.username, `admin`)
      assert.equal(config.auth.password, `secret`)
    } finally {
      await fs.rm(root, { recursive: true })
    }
  })

  it(`rejects web UI credentials without a password`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), `gearbox-config-`))
    try {
      const filename = path.join(root, `config.mjs`)
      await fs.writeFile(
        filename,
        `export default {
          clients: [{ id: "one" }],
          auth: { username: "admin" },
        }`
      )

      await assert.rejects(
        loadConfig(
          `${pathToFileURL(filename).href}?test=${Date.now()}`,
          filename,
          root
        ),
        /'auth' must contain a non-empty password/
      )
    } finally {
      await fs.rm(root, { recursive: true })
    }
  })
})
