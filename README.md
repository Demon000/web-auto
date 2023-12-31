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
7. Generate a self signed certificate.
   `sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout cert.key -out cert.crt`

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
-   Android Auto video
-   Instrument cluster video
-   Video decode (H264 & H265)
-   Audio input
-   Audio output
-   Media status
-   Navigation status (WIP)
-   Picture-in-picture video
-   Assistant key
-   Mouse support for interacting with the video
