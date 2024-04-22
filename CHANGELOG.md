# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.15.2](https://github.com/mikabytes/gearbox/compare/v0.15.1...v0.15.2) (2024-04-22)


### Features

* Refactor API, add logging levels ([37df4d5](https://github.com/mikabytes/gearbox/commit/37df4d581f66f473cb160ca776b14743ef3e02c3))


### Bug Fixes

* **#24:** Change GUID strategy to use much less bits. Sonarr is happy now ([0312c96](https://github.com/mikabytes/gearbox/commit/0312c96c26ebad7ab191e219a83c76cab2d65b69)), closes [#24](https://github.com/mikabytes/gearbox/issues/24)
* Disabled ratelimiter. Fixes [#22](https://github.com/mikabytes/gearbox/issues/22) ([35ba8da](https://github.com/mikabytes/gearbox/commit/35ba8daf601cf0a46b6e7f1c7c3e643191c42c9e))
* its now possible to pick client when adding torrent. Fixes [#23](https://github.com/mikabytes/gearbox/issues/23) ([b8324bb](https://github.com/mikabytes/gearbox/commit/b8324bba9467bf1e989cd40b0dceb4ffb1faf248))

## [0.15.1](https://github.com/mikabytes/gearbox/compare/v0.15.0...v0.15.1) (2024-04-21)


### Bug Fixes

* proper handle semver ([fc613c6](https://github.com/mikabytes/gearbox/commit/fc613c68a257ea15a516c04876c6b41ed9ebfb91))
* **rpc:** arguments field is optional. Fixes Autobrr ([4e66090](https://github.com/mikabytes/gearbox/commit/4e660901dca2960ea15620dc7b8028a6e5283563))
* When github caches, it would announce old version instead of new ([57ec886](https://github.com/mikabytes/gearbox/commit/57ec88610e238db24c06dd107f85476f5dc51d00))

## 0.15.0

- Added session-get, session-set Transmission RPC API methods. We should now be API compatible.

## 0.14.0

- Added torrent-get, torrent-set, torrent-set-location Transmission RPC API methods. We are getting closer to having a complete RPC API.
- Add option to select ip and port to listen to #20
- Bugfix: Drag-drop on Windows #21
- Double-click to show details of torrent
- Add Set Location feature. Fixes #19

## 0.13.1

- Fixed issue where slashes and backslashes wasn't recognized in filter values (thanks @Gaidouraki)

## 0.13.0

- Added support for adding torrents (you can drag and drop them from your computer)
- Added support for adding torrents (via file-picker, use the big + sign)
- Added API rate-limiting
- Added demo-config.mjs for those who want to experiment with Gearbox (same as demo-gearbox.xod.se)

## 0.12.2

- Rename KeyPress to Shortcuts, hopefully avoiding some overzelous adblockers

## 0.12.1

- Fix issue with download % showing 0 until finished

## 0.12.0

- Details view now show total stats for multiple selections
- Sidebar now indicates selected torrents

## 0.11.0

- Added ctrl+a to select all torrents
- Added a 'demo' connector for showcasing Gearbox

## 0.10.5

- Fix client showing download speed

## 0.10.2

- Fix white color on status when selected. Fix cursor:pointer on firefox

## 0.10.1

- Adjusted column sizes for better fit
- Fix issue with Seeds/Leechs tabs showing wrong number of total peers
- Fix issue with progress header not being visible after scroll
- Fix a bug where right-clicking a torrent wouldn't show it in details. Adjusted grid to show asc/desc icon

## 0.10.0

- Added styling and indicators for download and verifying torrents

## 0.9.1

- Fix issue with trackers that reports multiple instances with same sitename causing duplicates

## 0.9.0

- App will reload when data becomes out of sync
- When deleting files, UI will now show them with strike-through, instead of forcing user to wait for the messagebox to close
- Added keybindings for deleting torrents, see [README](README.md) for more info
- Added support for pausing/resuming torrents
- Added support for specifying config directory by GEARBOX_PATH env variable
