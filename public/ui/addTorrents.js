import "./popup.js"

import { component, css, html, useState } from "../component.js"
import formatSize from "../formatSize.js"
import * as torrentActions from "../torrentActions.js"
import useConfig from "../useConfig.js"

component(
  `x-add-torrents`,
  await css(import.meta.resolve(`./addTorrents.css`)),
  function AddTorrents({ torrentsToAdd, setTorrentsToAdd, done }) {
    const config = useConfig()
    const [uploadText, setUploadText] = useState(null)
    const [fileSelection, setFileSelection] = useState(
      torrentsToAdd.map((it, index) => Array(it.files.length).fill(true))
    )

    function renderTorrent(
      index,
      fileSelection,
      setFileSelection,
      { folders, files, indices }
    ) {
      const selectedIndices = fileSelection[index]

      function setSelectedIndices(newSelection) {
        const newFileSelection = [...fileSelection]
        newFileSelection[index] = newSelection
        setFileSelection(newFileSelection)
      }

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
                <div class="name">${name}</div>
                <div class="size">${formatSize(size)}</div>
              </div>
            `
          )}
        `
      }

      return renderPaths({ folders, files })
    }

    async function upload() {
      setUploadText(`0 of ${torrentsToAdd.length}`)

      const clientId = this.shadowRoot.querySelector(`select`).value

      try {
        for (const [index, torrent] of torrentsToAdd.entries()) {
          const args = {
            metainfo: torrent.data,
            filesWanted: fileSelection[index]
              .map((it, i) => (it ? i : -1))
              .filter((it) => it !== -1),
          }
          if (clientId) {
            args.clientId = clientId
          }
          await torrentActions.add(args)
          setUploadText(
            `${torrentsToAdd.indexOf(torrent) + 1} of ${torrentsToAdd.length}`
          )
        }
        done()
      } catch (e) {
        console.error(e)
        alert(e.message)
        return
      } finally {
        setUploadText(null)
      }
    }

    return html`
      <x-popup
        .title=${`Add`}
        .onDone=${() => done()}
        .disabled=${!!uploadText}
      >
        <select slot="buttons">
          <option value="">Auto</option>
          ${(config?.clients || []).map(
            (client) =>
              html` <option value="${client.id}">${client.id}</option>`
          )}
        </select>
        <button
          id="add"
          @click=${() => upload.call(this)}
          ?disabled=${!!uploadText}
          slot="buttons"
        >
          ${uploadText ? uploadText : `Add`}
        </button>
        ${torrentsToAdd.map(
          (it, index) => html`
            <h2>${it.name}</h2>
            ${renderTorrent(
              index,
              fileSelection,
              setFileSelection,
              buildDirectoryStructure(it.files)
            )}
          `
        )}
      </x-popup>
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
