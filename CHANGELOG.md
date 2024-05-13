# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.17.1](https://github.com/mikabytes/gearbox/compare/v0.17.0...v0.17.1) (2024-05-13)


### Bug Fixes

* Added queue actions, sometimes used by Sonarr ([2d66f53](https://github.com/mikabytes/gearbox/commit/2d66f533b8d759efc54c96322832003f4d286eb6))
* ctrl+click picks selections, shift+click deselects and selects all from last to pick, ctrl+shift+click combines the two ([85da264](https://github.com/mikabytes/gearbox/commit/85da2640ad15db3b2a0596731c8e8a3eae288ab0))
* Demo implementation to use same rateUpload/rateDownload as Transmission. Fixes crashed demo ([6abc799](https://github.com/mikabytes/gearbox/commit/6abc799868616f6496b30434c68cc7166153bc96))
* when only one torrent is selected and clicked again, it is deselected ([6c2c0dc](https://github.com/mikabytes/gearbox/commit/6c2c0dce382eb06b31d6b7359bea1a1e4cd600ef))

## [0.17.0](https://github.com/mikabytes/gearbox/compare/v0.16.1...v0.17.0) (2024-05-01)


### Features

* Added support for transferring torrents (not data) between clients! ([ba319ab](https://github.com/mikabytes/gearbox/commit/ba319ab498e8b3ca1dc9831dd0dd1e3972d558cd))
* Gearbox now copies the .torrent files into its own .../torrents folder, enabling cross-seed support. 'torrentsDir' must be set to enable this feature ([8fece0a](https://github.com/mikabytes/gearbox/commit/8fece0a9443a1ad602f9b66c6e25468e2da74f2a))
* Sidebar now togglable. Auto-hides or floats on small screens. ([774addf](https://github.com/mikabytes/gearbox/commit/774addf45ae06e721ea14f546666e8805eb80b92))


### Bug Fixes

* Limit debug logging so that base64-encoded files don't overwhelm the console ([ccbe8a0](https://github.com/mikabytes/gearbox/commit/ccbe8a0cb9b409137e5bbf538a2ebe741d8e633a))
* Move error sidebar filter higher up to draw more attention. Fixes [#30](https://github.com/mikabytes/gearbox/issues/30) ([d082951](https://github.com/mikabytes/gearbox/commit/d08295196ca5d7d15cb0a13f4f971235483cfa4e))
* Return response from client appropriately. Fixes [#31](https://github.com/mikabytes/gearbox/issues/31) ([3d410d3](https://github.com/mikabytes/gearbox/commit/3d410d3d13adb641c23f8cb0e7bb3241bf664719))

## [0.16.1](https://github.com/mikabytes/gearbox/compare/v0.16.0...v0.16.1) (2024-04-24)


### Bug Fixes

* Bug caused crash on startup ([343e8c0](https://github.com/mikabytes/gearbox/commit/343e8c05b5ac081cc614d92930ba90ed132ce690))

## [0.16.0](https://github.com/mikabytes/gearbox/compare/v0.15.2...v0.16.0) (2024-04-24)


### Features

* Add total upload/download speed. Fixes [#25](https://github.com/mikabytes/gearbox/issues/25) ([2a08140](https://github.com/mikabytes/gearbox/commit/2a081400f106c4e4b7aa145b2f25dc045a04ef28))
* Include link to changelog when announcing new version ([0dcc102](https://github.com/mikabytes/gearbox/commit/0dcc1026b09e600325a634836457ce54980fafb5))
* Prettier upload/download symbols. Fixes [#28](https://github.com/mikabytes/gearbox/issues/28) ([979d8c3](https://github.com/mikabytes/gearbox/commit/979d8c313c8a84a194ea6aa53774227f9cd85e3a))


### Bug Fixes

* Gearbox to return download-dir of first client, fixes [#29](https://github.com/mikabytes/gearbox/issues/29) ([e0e582a](https://github.com/mikabytes/gearbox/commit/e0e582a20c1b2825b65802af9c78314b9e0caa7e))
* Renamed button on upload torrent to 'Add'. Some users were confused by this ([b878dbf](https://github.com/mikabytes/gearbox/commit/b878dbfbe10ebd2cd89b9e8615d914d5e58a4201))
* RPC now supports Int64 tags, which should make Autobrr happy. ([4bab579](https://github.com/mikabytes/gearbox/commit/4bab579f08a3f4e21e46ea780bddd16bfc8c45ea))

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
