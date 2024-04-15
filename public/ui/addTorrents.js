import { component, css, html, useState, useEffect } from "../component.js"
import formatSize from "../formatSize.js"

component(
  `x-add-torrents`,
  await css(import.meta.resolve(`./addTorrents.css`)),
  function AddTorrents({ torrentsToAdd, setTorrentsToAdd }) {
    const [config, setConfig] = useState(null)

    useEffect(() => {
      async function updateConfig() {
        const res = await fetch(`/config`)
        if (res.ok) {
          try {
            const newConfig = await res.json()
            setConfig(newConfig)
          } catch (e) {
            console.error(e)
            setTimeout(updateConfig, 3000)
          }
        } else {
          setTimeout(updateConfig, 3000)
        }
      }
      updateConfig()
    }, [])

    function renderTorrent(total, { folders, files, indices }) {
      const [selectedIndices, setSelectedIndices] = useState(
        Array(total).fill(true)
      )

      console.log(selectedIndices)

      function checkFolder(indices, root, checked) {
        for (const folder of root.folders) {
          checkFolder(indices, folder, checked)
        }

        for (const file of root.files) {
          indices[file.index] = checked
        }
      }

      function allChecked(folder) {
        for (const file of folder.files) {
          if (!selectedIndices[file.index]) {
            return false
          }
        }
        for (const subFolder of folder.folders) {
          if (!allChecked(subFolder)) {
            return false
          }
        }
        return true
      }

      function renderPaths({ folders, files }) {
        return html`
          ${folders.map(
            (folder) => html`
              <div class="folder">
                <input
                  type="checkbox"
                  .checked=${allChecked(folder)}
                  @change=${(e) => {
                    checkFolder(selectedIndices, folder, e.target.checked)
                    setSelectedIndices([...selectedIndices])
                  }}
                />
                ${folder.name}
                <div class="folder-contents">${renderPaths(folder)}</div>
              </div>
            `
          )}
          ${files.map(
            ({ name, size, index }) => html`
              <div class="file">
                <input
                  type="checkbox"
                  .checked=${selectedIndices[index]}
                  @change=${(e) => {
                    const checked = e.target.checked
                    selectedIndices[index] = checked
                    setSelectedIndices([...selectedIndices])
                    e.preventDefault()
                  }}
                />
                ${name} (${formatSize(size)})
              </div>
            `
          )}
        `
      }

      return renderPaths({ folders, files })
    }

    return html`
      <div id="header">
        <h1>Add torrents</h1>
        <label>
          Client:
          <select>
            <option value="">Auto</option>
            ${(config?.backends || []).map(
              (client) =>
                html` <option value="${client.id}">${client.id}</option>`
            )}
          </select>
        </label>
        <button>Add</button>
      </div>
      ${torrentsToAdd.map(
        (it) => html`
          <h2>${it.name}</h2>
          ${renderTorrent(it.files.length, buildDirectoryStructure(it.files))}
        `
      )}
    `
  }
)

function buildDirectoryStructure(data) {
  const root = { folders: [], files: [] }

  function findFolder(name, folders) {
    return folders.find((folder) => folder.name === name)
  }

  function createFolder(name) {
    return { name, folders: [], files: [] }
  }

  function addPathToFileSystem(currentFolder, path, length, index) {
    path.forEach((part, pathIndex) => {
      if (pathIndex === path.length - 1) {
        // It's a file
        currentFolder.files.push({ name: part, size: length, index: index })
      } else {
        // It's a folder
        let folder = findFolder(part, currentFolder.folders)
        if (!folder) {
          folder = createFolder(part)
          currentFolder.folders.push(folder)
          // Keep a reference to the parent for easier index propagation
          folder.parent = currentFolder
        }
        currentFolder = folder
      }
    })
  }

  data.forEach((item, index) => {
    addPathToFileSystem(root, item.path, item.length, index)
  })

  return root
}
