import { css } from "../../component.js"

export default css`
  :host {
    display: flex;
    flex-direction: column;
    width: 200px;
    overflow: auto;
  }

  section {
    display: grid;
    grid-template-columns: auto 1fr auto;
  }

  .selectItem {
    display: contents;
    padding: 3px 6px;
    user-select: none;
  }

  .selectItem > * {
    padding: 3px 6px;
  }

  .selected > * {
    background-color: var(--primary);
    color: white;
  }

  h1 {
    grid-area: header;
    display: block;
    padding: 3px 6px;
    margin: 0;
    font-size: 14px;
    background-color: var(--lightgray);
  }
`
