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

  .row.error > * {
    color: red;
  }

  .row.selected > * {
    background-color: var(--primary);
    color: white;
  }

  .row > * {
    box-sizing: border-box;
    padding: 3px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

  #context-menu {
    position: absolute;
    background: #efefef;
    border: 1px solid var(--gray);
    padding: 0;
    border-radius: 5px;
    box-shadow: 0 0 5px var(--gray);
    outline: none;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  #context-menu button {
    display: block;
    list-style: none;
    padding: 6px 20px;
    margin: 0;
    cursor: default;
    border: none;
  }

  #context-menu button:hover {
    background-color: var(--lightergray);
  }

  .grayout {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 1;
  }

  #delete-confirm {
    font-size: 16px;
    background-color: #efefef;
    border: 1px solid var(--gray);
    border-radius: 3px;
    padding: 20px 30px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  #delete-confirm button {
    padding: 6px;
  }
`
