<p align="center">
  <img src="public/icon_512x512.png" width="300" height="300" alt="Gearbox icon" />
</p>

# Gearbox

A modern web UI for Transmission built to handle 300,000+ torrents.

## Features

🤗 Federated operation - provides a unified UI for multiple backends</br>
🐎 Super-fast - all UI interactions are instantaneous</br>
🧠 Low memory - 30% compared to built-in Transmission web UI @ 7000 torrents</br>

## Installation

### NPM

```
npm add -g gearbox
gearbox
```

### Docker

```
docker run -p 2112:2112 -it ghcr.io/mikabytes/gearbox:latest
```

### Source

```
git clone https://github.com/mikabytes/gearbox.git
cd gearbox
npm start
```

## Configuration

A `config.js` file will be looked for in the current directory. If it doesn't exist, it will be created for you. Example:

```js
export default {
  backends: [
    { id: `torr1`, ip: "192.168.0.1", port: 9091 },
    { id: `torr2`, ip: "127.0.0.1", port: 9091 },
    { id: `torr3`, ip: "10.0.107.1", port: 80 },
  ],
}
```

All fields are required.

# id

Must be at least one character, and no more than 6 characters. May only contain lowercase a-z or 0-9.

Note: If you need to integrate a third-party application that only supports 32-bit numbers (this is rare), then this may only be 2 characters long.

# ip

Address of a Transmission daemon with Web-UI enabled. This can be a local or remote IP address, or a DNS name.

# port

Port of a Transmission daemon with Web-UI enabled. These are usually hosted on 9091.
