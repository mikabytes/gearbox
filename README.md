![](public/icon_96x96.png)

# Gearbox

A modern web UI for Transmission built to handle 300,000+ torrents.

## Features

🤗 Federated operation - support for several concurrent Transmission backends
🐎 Super-fast UI - all interactions are instantaneous
🧠 Low memory use - 30% compared to built-in web UI @ 7000 torrents

## Installation

After starting, the UI is available at http://localhost:3000

### NPM

```
npm add -g gearbox
gearbox
```

### Docker

```
docker run -p 3000:3000 -it ghcr.io/mikabytes/gearbox:latest
```
