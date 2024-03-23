import { css } from "../../component"

export default css`
  :host {
    display: grid;
    grid-template:
      "header header header" 50px
      "sidebar drag-hor torrents" auto
      "drag-ver drag-ver drag-ver" 3px
      "footer footer footer" min-content;
    grid-template-columns: auto 3px 1fr;
    height: 100%;
    width: 100%;
  }

  x-torrents {
    grid-area: torrents;
  }

  x-header {
    grid-area: header;
  }

  #sidebar {
    grid-area: sidebar;
  }

  #footer {
    grid-area: footer;
    height: 50px;
  }

  #drag-ver {
    grid-area: drag-ver;
    height: 3px;
    background-color: #ccc;
  }

  #drag-hor {
    grid-area: drag-hor;
    width: 3px;
    background-color: #ccc;
  }
`
