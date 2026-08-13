// Pure column-layout helpers, kept import-free so they are unit-testable.

export function visibleColumns(columns, settings = {}) {
  return columns.filter(
    (column) => column.required || settings.columns?.[column.key] !== false
  )
}

export function gridTemplate(visible, widths = {}) {
  return visible
    .map((column) => {
      const width = Math.max(45, widths[column.key] ?? column.width)
      return column.key === `name` ? `minmax(${width}px, 1fr)` : `${width}px`
    })
    .join(` `)
}
