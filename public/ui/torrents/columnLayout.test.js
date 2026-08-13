import assert from "assert"
import { gridTemplate, visibleColumns } from "./columnLayout.js"

const catalog = [
  { key: `name`, name: `Name`, width: 200, required: true },
  { key: `eta`, name: `ETA`, width: 75 },
  { key: `uploadRatio`, name: `Ratio`, width: 65 },
]

describe(`column layout`, () => {
  it(`hides columns disabled in settings but never required ones`, () => {
    const visible = visibleColumns(catalog, {
      columns: { eta: false, name: false },
    })

    assert.deepEqual(
      visible.map((column) => column.key),
      [`name`, `uploadRatio`]
    )
  })

  it(`shows everything by default`, () => {
    assert.equal(visibleColumns(catalog).length, 3)
  })

  it(`builds a grid template with the flexible name column and overrides`, () => {
    const template = gridTemplate(catalog, { eta: 120 })

    assert.equal(template, `minmax(200px, 1fr) 120px 65px`)
  })

  it(`clamps widths to a usable minimum`, () => {
    assert.equal(gridTemplate([catalog[1]], { eta: 4 }), `45px`)
  })
})
