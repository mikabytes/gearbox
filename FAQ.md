# When making a transfer, I'm getting a "torrent does not exist" error

Gearbox needs to know where the .torrent file is in order to transfer it. You will need to make sure that you have set the `torrentDir` configuration option correctly.

Transmission stores its .torrent files in a subfolder `torrents` in its configuration folder. For example, if transmission stores its configuration at `~/.config/transmission` then you need to set the `torrentDir` option to `~/.config/transmission/torrents`.

These are some common Transmission config paths:

| System            | Path                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| MacOS             | `~/.config/transmission`                                             |
| Linux             | `~/.config/transmission`                                             |
| Linux (root)      | `/etc/transmission-daemon/`                                          |
| Windows           | `C:\Users\<user>\AppData\Local\Transmission`                         |
| Windows (service) | `C:\Windows\ServiceProfiles\LocalService\AppData\Local\Transmission` |
| Docker            | `/config`                                                            |
