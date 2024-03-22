import { css } from "../../component.js"

export default css`
  :host {
    display: block;
    color: var(--gray);
  }

  .row {
    display: flex;
    align-items: center;
  }

  .row > * {
    box-sizing: border-box;
    padding: 3px 6px;
    overflow: hidden;
    white-space: nowrap;
    user-select: none;
  }

  .header {
    background-color: #efefef;
    font-weight: bold;
    color: #999;
    cursor: pointer;
  }

  .header.sorted.reverse:after {
    content: "▼";
  }

  .header.sorted:after {
    content: "▲";
    font-size: 14px;
  }

  .addedDate {
    width: 120px;
  }
  .name {
    width: 100%;
  }
  .totalSize {
    width: 80px;
  }
  .isSeeding {
    width: 120px;
  }
  .peersGettingFromUs {
    width: 100px;
  }
  .peersSendingToUs {
    width: 100px;
  }
  .peersSendingToUs {
    width: 100px;
  }
  .uploadRatio {
    width: 100px;
  }
`
