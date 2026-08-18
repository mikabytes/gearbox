import { component, html, css, useEffect } from "../component.js"
import { themes } from "../applyTheme.js"
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

    const theme = settings.theme ?? `classic`
    const appearance = settings.appearance ?? {}

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

          <section>
            <h3>Theme</h3>
            <div class="themes">
              ${themes.map(
                (option) => html`
                  <label
                    class="theme-card ${theme === option.id ? `active` : ``}"
                    data-theme=${option.id}
                  >
                    <input
                      type="radio"
                      name="theme"
                      .checked=${theme === option.id}
                      @change=${() => updateSettings({ theme: option.id })}
                    />
                    <span class="preview">
                      <span class="swatch bg"></span>
                      <span class="swatch accent"></span>
                      <span class="swatch complete"></span>
                      <span class="swatch downloading"></span>
                    </span>
                    ${option.name}
                  </label>
                `
              )}
            </div>
          </section>

          <section>
            <h3>Appearance</h3>
            <label class="slider">
              Corner radius
              <input
                type="range"
                min="0"
                max="14"
                step="1"
                .value=${appearance.radius ?? ``}
                @input=${(e) =>
                  updateSettings({
                    appearance: { radius: Number(e.target.value) },
                  })}
              />
              <span class="value">
                ${appearance.radius != null
                  ? `${appearance.radius}px`
                  : `theme default`}
              </span>
            </label>
            <label class="select">
              Scrollbars
              <select
                @change=${(e) =>
                  updateSettings({
                    appearance: { scrollbar: e.target.value || null },
                  })}
              >
                <option value="" ?selected=${!appearance.scrollbar}>
                  Theme default
                </option>
                <option value="thin" ?selected=${appearance.scrollbar === `thin`}>
                  Thin
                </option>
                <option value="none" ?selected=${appearance.scrollbar === `none`}>
                  Hidden
                </option>
              </select>
            </label>
            <button
              class="minor"
              ?disabled=${appearance.radius == null && !appearance.scrollbar}
              @click=${() => updateSettings({ appearance: null })}
            >
              Reset appearance
            </button>
          </section>
        </div>
      </div>
    `
  }
)
