import { css } from "../../component.js"

export default css`
  :host {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .container {
    display: grid;
    color: var(--darkgray);
    grid-template-columns: 85px minmax(100px, 1fr) 80px 120px 70px 70px 100px;
    overflow: auto;
    width: 100%;
    max-height: 100%;
  }

  .row {
    display: contents;
  }

  .row.selected > * {
    background-color: var(--primary);
    color: white;
  }

  .row > * {
    box-sizing: border-box;
    padding: 3px 6px;
    white-space: nowrap;
    user-select: none;
  }

  .header {
    background-color: var(--lightgray);
    font-weight: bold;
    cursor: pointer;
    position: sticky;
    top: 0;
  }

  .header.sorted.reverse:after {
    content: "▼";
  }

  .header.sorted:after {
    content: "▲";
    font-size: 14px;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`
