import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { constants } from "node:fs"
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  `..`
)
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), `gearbox-package-`))

try {
  const packOutput = run(
    npmCommand(),
    [
      `pack`,
      `--json`,
      `--ignore-scripts`,
      `--pack-destination`,
      temporaryRoot,
    ],
    repositoryRoot
  )
  const [{ filename }] = JSON.parse(packOutput)
  const tarball = path.join(temporaryRoot, filename)
  const installRoot = path.join(temporaryRoot, `install`)
  await mkdir(installRoot)

  run(
    npmCommand(),
    [
      `install`,
      `--ignore-scripts`,
      `--omit=dev`,
      `--no-audit`,
      `--no-fund`,
      `--prefix`,
      installRoot,
      tarball,
    ],
    repositoryRoot
  )

  const packageRoot = path.join(
    installRoot,
    `node_modules`,
    `gearbox-torrent`
  )
  const expectedFiles = await expectedPackageFiles()
  const installedFiles = new Set(await filesBelow(packageRoot))
  const missing = [...expectedFiles].filter((file) => !installedFiles.has(file))
  const unexpected = [...installedFiles].filter(
    (file) => !expectedFiles.has(file)
  )

  assert.deepEqual(missing, [], `Package is missing:\n${missing.join(`\n`)}`)
  assert.deepEqual(
    unexpected,
    [],
    `Package contains unexpected files:\n${unexpected.join(`\n`)}`
  )

  await verifyRelativeImports(packageRoot, installedFiles)

  const packageJson = JSON.parse(
    await readFile(path.join(packageRoot, `package.json`), `utf8`)
  )
  const executable =
    process.platform === `win32` ? `gearbox.cmd` : `gearbox`
  await access(path.join(installRoot, `node_modules`, `.bin`, executable))
  if (process.platform !== `win32`) {
    await access(
      path.join(packageRoot, packageJson.bin.gearbox),
      constants.X_OK
    )
  }

  for (const dependency of Object.keys(packageJson.dependencies)) {
    await access(
      path.join(installRoot, `node_modules`, dependency, `package.json`)
    )
  }

  console.log(
    `Package smoke test passed (${installedFiles.size} files, all relative imports resolved)`
  )
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

async function expectedPackageFiles() {
  const expected = new Set([
    `CHANGELOG.md`,
    `README.md`,
    `config-demo.mjs`,
    `package.json`,
  ])

  for (const directory of [`public`, `server`]) {
    for (const file of await filesBelow(path.join(repositoryRoot, directory))) {
      if (file.endsWith(`.test.js`) || file.endsWith(`.xcf`)) continue
      expected.add(path.posix.join(directory, file))
    }
  }

  return expected
}

async function filesBelow(root, current = root) {
  const files = []
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolutePath = path.join(current, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await filesBelow(root, absolutePath)))
    } else if (entry.isFile()) {
      files.push(toPosix(path.relative(root, absolutePath)))
    }
  }
  return files.sort()
}

async function verifyRelativeImports(packageRoot, installedFiles) {
  const patterns = [
    /\bfrom\s*["'`]([^"'`]+)["'`]/g,
    /\bimport\s*["'`]([^"'`]+)["'`]/g,
    /\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /\bimport\.meta\.resolve\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  ]

  for (const file of installedFiles) {
    if (!file.endsWith(`.js`)) continue
    const source = await readFile(path.join(packageRoot, file), `utf8`)

    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const specifier = match[1].split(/[?#]/, 1)[0]
        if (!specifier.startsWith(`.`)) continue

        const target = resolveImport(file, specifier)
        const candidates = [target, `${target}.js`, path.posix.join(target, `index.js`)]
        assert(
          candidates.some((candidate) => installedFiles.has(candidate)),
          `${file} imports missing package file ${specifier}`
        )
      }
    }
  }
}

function resolveImport(sourceFile, specifier) {
  if (sourceFile.startsWith(`public/`)) {
    const browserPath = sourceFile.slice(`public/`.length)
    const url = new URL(specifier, `https://gearbox.invalid/${browserPath}`)
    return path.posix.join(`public`, url.pathname.replace(/^\/+/, ``))
  }

  return path.posix.normalize(
    path.posix.join(path.posix.dirname(sourceFile), specifier)
  )
}

function npmCommand() {
  return process.platform === `win32` ? `npm.cmd` : `npm`
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: `utf8`,
  })
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(` `)} failed:\n${result.stdout}${result.stderr}`
    )
  }
  return result.stdout
}

function toPosix(filename) {
  return filename.split(path.sep).join(path.posix.sep)
}
