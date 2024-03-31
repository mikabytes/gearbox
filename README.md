<p align="center">
  <img src="public/icon_512x512.png" width="300" height="300" alt="Gearbox icon" />
</p>

# Gearbox

Gearbox is a modern web UI for Transmission, designed to efficiently manage over 300,000 torrents.

## Features

- 🤗 **Federated operation**: Offers a unified UI across multiple backends.
- 🐎 **Super-fast**: UI interactions are instantaneous.
- 🧠 **Low memory usage**: Uses 30% less memory compared to the standard Transmission web UI (at 7,000 torrents).

## Why Gearbox?

Torrent clients typically have a limit on the number of torrents they can handle. The conventional solution upon reaching this limit is to launch additional instances. This workaround might suffice for managing two or three instances, but it becomes cumbersome with more. Gearbox was developed to provide a singular interface for controlling multiple instances seamlessly. Beyond that, we recognized deficiencies in the Transmission default web interface. Our goal was to incorporate Deluge-like filters and introduce a superior search functionality unmatched by any other.

## Installation

### NPM

```
npm add -g gearbox-torrent
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

For active development, you may run `pnpm watch` for auto-reloading.

## Configuration

Gearbox searches for a `config.mjs` file in the current directory. If it doesn't find one, it will create one automatically. Here's an example:

```js
export default {
  backends: [
    { id: `torr1`, ip: "192.168.0.1", port: 9091 },
    { id: `torr2`, ip: "127.0.0.1", port: 9091 },
    {
      id: `torr3`,
      ip: "10.0.107.1",
      port: 80,
      user: "admin",
      password: "supersecret",
    },
  ],
}
```

All fields are required.

**id**: Should be at least one character long and no more than six characters. Can only include lowercase letters (a-z) and numbers (0-9).

_Note:_ In the rare case of needing to integrate with a third-party application that only supports 32-bit numbers, the id must be restricted to two characters.

**ip**: Specifies the address of a Transmission daemon with Web-UI enabled. This can be a local or remote IP address or a DNS name.

**port**: Designates the port for a Transmission daemon with Web-UI enabled, typically 9091.

**user** / **password**: Authentication that you want to use with Transmission.

## Usage

### Filters & Search

- Freetext in search bar to filter based on name, file path, or file extension.
- Click on a filter in the sidebar to choose it.
- Click on it again to remove it.
- Shift-click to to pick the inverse of a filter. For example, if you shift-click on "Everything's fine", all torrents that are **not** fine will be shown.

_Advanced usage:_ [Any field](https://github.com/transmission/transmission/blob/main/libtransmission/transmission.h#L1420) sent from Transmission can be used in the search bar. For example, if you want to list all torrents that haven't downloaded anything, you could type `percentDone:0`. You also have the option to create a `"OR"` filter by putting arguments in parenthesis. Example: `clientId:(trans1 trans2)` will show you any torrents from Transmission backend `trans1` OR `trans2`.

### Sorting

You may sort by clicking on the header of a column. Click on a column twice to sort in the other direction.

### Performance

Gearbox was tested for memory use at 7,000 torrents, showing 90MB of memory use where Transmission Web Interface used 314MB.

It was also stress-tested at 370,000 torrents on an average PC. While it took a good moment to start, and used 1.7GB of memory, it was still very fast after that. The real limit is not known, it may be in the millions depending on hardware.

## Roadmap

Currently Gearbox does a good job to give you insight into where your torrents are and what they're doing. You can also delete them by right-clicking on them. There are many more features planned, check out the Issues tab!

## Contributing

Want to help? You can do so by suggesting features or reporting bugs (in the Issues tab), or by submitting a pull request.

### Tests

Source code should have tests whenever you're doing something that is not UI related, especially if it's complex to wrap your head around. Don't add tests for UI interactions, as these tend to become more troublesome than they help out.

### Dependencies

Strive to keep the codebase slim by not including unnecessary dependencies. If something can be achieved just as easily natively as with some third-party package, then it should be done natively. Some examples of these are Axios and jQuery.
