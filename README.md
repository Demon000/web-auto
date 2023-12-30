# WebAuto

## Dependencies

### Ubuntu

`sudo apt install nodejs npm protobuf-compiler`

If using `androidAuto.tcpDeviceHandlerConfig.scanOptions` config:

`sudo apt install nmap`

## Installation

1. `git clone https://github.com/Demon000/web-auto`
2. `cd web-auto`
3. `cp config.default.json5 config.json5`
4. Open the `config.json5` file and configure it
5. `npm install`
6. `npm run build`

### Electron

1. `npm run prepare-electron`
2. `npm run start-electron`

### Node

#### Server

1. `npm run prepare-node`
   (not necessary unless `prepare-electron` has been run previously)
2. `npm run start-node`

#### Web

1. `cp web/.env.local.default web/.env.local`
2. Open the `web/.env.local` file and configure it with the same parameters as
   `nodeAndroidAuto.webSocketServer` from `config.json`.
3. `npm run start-web`

## Features

-   Connection via TCP (Head unit server enabled on phone)
-   Connection via USB
-   Connection via Bluetooth
-   Video (H264 & H265)
-   Audio input
-   Audio output
-   Media status (WIP)
-   Navigation status (WIP)
-   Picture-in-picture video
-   Mouse support for interacting with the video
