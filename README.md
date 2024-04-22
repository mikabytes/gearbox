<p align="center">
  <img src="public/icon_512x512.png" width="300" height="300" alt="Gearbox icon" />
</p>

# Gearbox

Gearbox is a modern web UI for Transmission, designed to efficiently manage over 300,000 torrents.

[Try live demo](https://demo-gearbox.xod.se)

## Features

- 🤗 **Federated operation**: Offers a unified UI across multiple backends.
- 🐎 **Super-fast**: UI interactions are instantaneous.
- 🧠 **Low memory usage**: Uses 30% less memory compared to the standard Transmission web UI (at 7,000 torrents).

## Why Gearbox?

Torrent clients typically have a limit on the number of torrents they can handle. The conventional solution upon reaching this limit is to launch additional instances. This workaround might suffice for managing two or three instances, but it becomes cumbersome with more. Gearbox was developed to provide a singular interface for controlling multiple instances seamlessly. Beyond that, we recognized deficiencies in the Transmission default web interface. Our goal was to incorporate Deluge-like filters and introduce a superior search functionality unmatched by any other.

Gearbox is Transmission RPC compatible. Any software that can communicate with Transmission can also communicate with Gearbox.

## Installation

### NPM

```
npm add -g gearbox-torrent
gearbox
```

### Docker

_Note:_ after running it once to create the `config.mjs` file, you will have to change `ip` to `0.0.0.0`. The default does not allow access outside local machine.

```
docker run -p 2112:2112 -it -e GEARBOX_PATH=/config -v $PWD:/config ghcr.io/mikabytes/gearbox:latest
```

### Source

```
git clone https://github.com/mikabytes/gearbox.git
cd gearbox
npm start
```

For active development, you may run `pnpm watch` for a setup where server restarts automatically on file changes. It also enables live reloading in the browser.

## Configuration

By default, Gearbox automatically searches for a `config.mjs` file within the current directory. Should it fail to locate one, Gearbox will proceed to generate a new `config.mjs` file automatically. Additionally, users have the option to direct Gearbox to a specific folder for the `config.mjs` file by setting the `GEARBOX_PATH` environment variable.

Example `config.mjs`:

```js
export default {
  clients: [
    { id: `torr1`, ip: "192.168.0.1", port: 9091, type: "transmission" },
    { id: `torr2`, ip: "127.0.0.1", port: 9091, type: "transmission" },
    {
      id: `torr3`,
      host: "10.0.107.1",
      port: 80,
      user: "admin",
      password: "supersecret",
      type: "transmission",
      maxCount: 5000,
    },
  ],
  addTorrentStrategy: "least-count", // or "round-robin", "first-found",
  ip: "127.0.0.1",
  port: 2112,
  logLevel: "warn",
}
```

### Clients

_Formerly called "backends"_

A list of Transmission torrent clients to connect to.

**id**: Should be at least one character long and no more than six characters. Can only include lowercase letters (a-z) and numbers (0-9).

_Note:_ In the rare case of needing to integrate with a third-party application that only supports 32-bit numbers, the id must be restricted to two characters.

**host**: Specifies the address of a Transmission daemon with Web-UI enabled. This can be a local or remote IP address or a DNS name. _Formerly called ip_

**port**: Designates the port for a Transmission daemon with Web-UI enabled, typically 9091.

**user** / **password**: Authentication that you want to use with Transmission. Optional

**type**: The type of torrent client. Defaults to `transmission`. Currently, only `transmission` is supported.

**maxCount**: A client is qualified to accept new torrents only if it has less than this number of existing torrents. Useful not to overload any individual client. I.e, Transmission usually can't handle more than 5-10 thousand torrents. This rule is discarded if omitted or negative. If it is set to zero, it always disqualifies this client from receiving new torrents.

### addTorrentStrategy

The configuration for adding new torrents. Deciding which client gets the new torrent is decided here. Client `maxCount` is respected. If no client was found that matches configuration, an error will be thrown.

**strategy**: The strategy for adding new torrents. Defaults to `least-count`.

| **Strategy**  | **Description**                                                      |
| :------------ | :------------------------------------------------------------------- |
| `least-count` | Add it to the client that has the least number of torrents.          |
| `round-robin` | Spread new torrents evenly across all clients.                       |
| `first-found` | Add it to the first client available client (in order of `backends`) |

### ip / port

This specifies the IP and port on which the Gearbox server will listen. Defaults to `127.0.0.1` and `2112` respectively.

If you want to be able to access Gearbox from outside the local machine, you should set `ip` to `0.0.0.0`.

### logLevel

The logging level. Defaults to `warn`, can be any of `error`, `warn`, or `debug`.

## Usage

### Filters & Search

- Freetext in search bar to filter based on name, file path, or file extension.
- Click on a filter in the sidebar to choose it.
- Click on it again to remove it.
- Shift-click to to pick the inverse of a filter. For example, if you shift-click on "Everything's fine", all torrents that are **not** fine will be shown.

_Advanced usage:_ [Any field](https://github.com/transmission/transmission/blob/main/libtransmission/transmission.h#L1420) sent from Transmission can be used in the search bar. For example, if you want to list all torrents that haven't downloaded anything, you could type `percentDone:0`. You also have the option to create a `"OR"` filter by putting arguments in parenthesis. Example: `clientId:(trans1 trans2)` will show you any torrents from backends `trans1` OR `trans2`.

### Sorting

You may sort by clicking on the header of a column. Click on a column twice to sort in the other direction.

### Performance

Gearbox was tested for memory use at 7,000 torrents, showing 90MB of memory use where Transmission Web Interface used 314MB.

It was also stress-tested at 370,000 torrents on an average PC. While it took a good moment to start, and used 1.7GB of memory, it was still very fast after that. The real limit is not known, it may be in the millions depending on hardware.

### Keyboard shortcuts

| Key                          | Action                                              |
| :--------------------------- | :-------------------------------------------------- |
| `x`, `-`, `DEL`, `Backspace` | Delete                                              |
| `Space`                      | If all selected are paused, then resume, else pause |
| `Ctrl+A`                     | Select all                                          |
| `Ctrl+L`                     | Change location                                     |

## Protocol

Gearbox implements the [Transmission RPC protocol](https://github.com/transmission/transmission/blob/main/docs/rpc-spec.md). Anywhere you can use Transmission RPC, you can use Gearbox, including \*Arrs, autodl-irssi, etc.

There are a few differences. When adding torrents you can specify which torrent client should receive the new torrent using the non-standard `clientId` field. If this field is omitted, the `addTorrentStrategy` together with `maxCount` will be used to pick a client.

When using `session-get`, a reasonable hard-coded default is returned. `session-set` is not supported.

## Roadmap

Currently Gearbox does a good job to give you insight into where your torrents are and what they're doing. You can also delete them by right-clicking on them. There are many more features planned, check out the Issues tab!

## Contributing

Want to help? You can do so by suggesting features or reporting bugs (in the Issues tab), or by submitting a pull request.

### Tests

Source code should have tests whenever you're doing something that is not UI related, especially if it's complex to wrap your head around. Don't add tests for UI interactions, as these tend to become more troublesome than they help out.

### Dependencies

Strive to keep the codebase slim by not including unnecessary dependencies. If something can be achieved just as easily natively as with some third-party package, then it should be done natively. Some examples of these are Axios and jQuery.
