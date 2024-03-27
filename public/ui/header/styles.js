import { css } from "../../component.js"

export default css`
  :host {
    background-color: var(--lightgray);
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid var(--gray);
  }

  div {
    flex: 0 0 50px;
  }

  input {
    flex: 1 1 auto;
    font-size: 16px;
    padding: 8px 16px;
    border: 0px;
    background-color: var(--lightgray);
    color: var(--darkgray);
    outline: none;
    font-weight: bold;
  }
`
