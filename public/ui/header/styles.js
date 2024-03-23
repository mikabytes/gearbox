import { css } from "../../component"

export default css`
  :host {
    background-color: var(--lightgray);
    display: flex;
    align-items: center;
    padding: 0 10px;
    border-bottom: 1px solid var(--gray);
  }

  div {
    flex: 0 0 150px;
  }

  input {
    flex: 1 1 auto;
    padding: 8px 16px;
    border-radius: 50px;
  }
`
