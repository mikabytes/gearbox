import { component, html, css, useEffect } from "../component.js"
import { columns } from "./torrents/columns.js"
import useSettings from "../useSettings.js"

component(
  `x-settings`,
  await css(import.meta.resolve(`./settings.css`)),
  function Settings({ onClose }) {
    const [settings, updateSettings] = useSettings()

    useEffect(() => {
      const onKeydown = (e) => {
        if (e.key === `Escape`) {
          onClose()
        }
      }
      document.addEventListener(`keydown`, onKeydown)
      return () => document.removeEventListener(`keydown`, onKeydown)
    }, [onClose])

    const toggleColumn = (key) => (e) => {
      updateSettings({ columns: { [key]: e.target.checked } })
    }

    return html`
      <div class="grayout" @click=${onClose}>
        <div
          class="dialog"
          role="dialog"
          aria-label="Settings"
          @click=${(e) => e.stopPropagation()}
        >
          <header>
            <h2>Settings</h2>
            <button class="close" aria-label="Close" @click=${onClose}>
              ✕
            </button>
          </header>

          <section>
            <h3>Columns</h3>
            <p class="hint">
              Choose which columns to show. Drag a column edge in the table to
              resize it.
            </p>
            <div class="options">
              ${columns.map(
                (column) => html`
                  <label>
                    <input
                      type="checkbox"
                      ?disabled=${column.required}
                      .checked=${column.required ||
                      settings.columns?.[column.key] !== false}
                      @change=${toggleColumn(column.key)}
                    />
                    ${column.name}
                  </label>
                `
              )}
            </div>
            <button
              class="minor"
              ?disabled=${!settings.columnWidths}
              @click=${() => updateSettings({ columnWidths: null })}
            >
              Reset column widths
            </button>
          </section>
        </div>
      </div>
    `
  }
)
