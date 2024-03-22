import { css } from "component"

export default css`
  :host {
    display: grid;
    grid-template:
      "header header" 20px
      "sidebar torrents" auto
      "footer footer";
    height: 100%;
    width: 100%;
  }

  x-torrents {
    grid-area: torrents;
    overflow: auto;
  }

  #header {
    grid-area: header;
  }

  #footer {
    grid-area: footer;
    height: 50px;
  }
`
