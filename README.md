# WebAuto

## Dependencies

### Ubuntu

`sudo apt install protobuf-compiler`

If using `TcpDeviceHandler`:

`sudo apt install nmap`

#### NVM

To get the latest Node version, use [nvm](https://github.com/nvm-sh/nvm).

## Installation

1. `git clone https://github.com/Demon000/web-auto`
2. `cd web-auto`
3. `cp config.default.json5 config.json5`
4. Open the `config.json5` file and configure it
5. Generate a self signed certificate.
   `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout cert.key -out cert.crt`
6. `npm install`
7. `npm run build`

### Electron

1. `npm run prepare-electron`
2. `npm run start-electron`

### Node

#### Server

1. `npm run prepare-node`
   (not necessary unless `prepare-electron` has been run previously)
2. `npm run start-node`

#### Web

1. `npm run start-web`

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
