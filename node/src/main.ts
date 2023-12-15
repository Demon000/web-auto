import { getLogger, setConfig } from '@web-auto/logging';
import { lilconfigSync } from 'lilconfig';
import JSON5 from 'json5';

import { assert } from 'typia';
import {
    NodeAndroidAutoServer,
    type NodeCommonAndroidAutoConfig,
} from '@web-auto/node-common';
import { ANDROID_AUTO_IPC_REGISTRY_NAME } from '@web-auto/android-auto-ipc';
import { SocketIpcServiceRegistry } from '@web-auto/socket-ipc/main.js';
import { createServer } from 'node:http';

type NodeAndroidAutoConfig = {
    nodeAndroidAuto: {
        webSocketServer: {
            port: number;
            host: string;
        };
    };
} & NodeCommonAndroidAutoConfig;

const config = lilconfigSync('web-auto', {
    loaders: {
        '.json5': (_filepath, content) => {
            return JSON5.parse(content);
        },
    },
    searchPlaces: ['config.json5'],
}).search()?.config as NodeAndroidAutoConfig;

assert<NodeAndroidAutoConfig>(config);

setConfig(config.logging);

const logger = getLogger('electron');

logger.info('Electron config', config);

let androidAutoServer: NodeAndroidAutoServer | undefined;
let androidAutoIpcServiceRegistry: SocketIpcServiceRegistry | undefined;

const server = createServer();

if (config.androidAuto !== undefined) {
    androidAutoIpcServiceRegistry = new SocketIpcServiceRegistry(
        ANDROID_AUTO_IPC_REGISTRY_NAME,
        server,
    );

    androidAutoIpcServiceRegistry.register();

    androidAutoServer = new NodeAndroidAutoServer(
        androidAutoIpcServiceRegistry,
        config.androidAuto,
    );

    androidAutoServer.build();

    androidAutoServer.start().catch((err) => {
        logger.error('Failed to start android auto server', err);
    });
}

const port = config.nodeAndroidAuto.webSocketServer.port;
const host = config.nodeAndroidAuto.webSocketServer.host;

server.listen(port, host);