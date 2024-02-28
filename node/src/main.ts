import { getLogger, setConfig } from '@web-auto/logging';
import { lilconfigSync } from 'lilconfig';
import JSON5 from 'json5';

import { assert } from 'typia';
import {
    NodeAndroidAutoServer,
    NodeAndroidAutoServerBuilder,
    type NodeCommonAndroidAutoConfig,
} from '@web-auto/node-common';
import { ANDROID_AUTO_IPC_REGISTRY_NAME } from '@web-auto/android-auto-ipc';
import { SocketIpcServiceRegistry } from '@web-auto/socket-ipc/main.js';
import { Server, createServer } from 'node:https';
import { readFileSync } from 'node:fs';

export type NodeAndroidAutoConfig = {
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return JSON5.parse(content);
        },
    },
    searchPlaces: ['config.json5'],
}).search()?.config as NodeAndroidAutoConfig;

assert<NodeAndroidAutoConfig>(config);

setConfig(config.logging);

const logger = getLogger('node');

logger.info('Electron config', config);

const startAndroidAuto = async (server: Server): Promise<void> => {
    if (config.androidAuto === undefined) {
        return;
    }

    const androidAutoIpcServiceRegistry = new SocketIpcServiceRegistry(
        ANDROID_AUTO_IPC_REGISTRY_NAME,
        server,
    );

    androidAutoIpcServiceRegistry.register();

    const builder = new NodeAndroidAutoServerBuilder(
        androidAutoIpcServiceRegistry,
        config.androidAuto,
    );

    const androidAutoServer = new NodeAndroidAutoServer(
        builder,
        androidAutoIpcServiceRegistry,
    );

    try {
        await androidAutoServer.start();
    } catch (err) {
        logger.error('Failed to start android auto server', err);
    }
};

(async () => {
    const server = createServer({
        cert: readFileSync('../cert.crt'),
        key: readFileSync('../cert.key'),
    });

    await startAndroidAuto(server);

    const port = config.nodeAndroidAuto.webSocketServer.port;
    const host = config.nodeAndroidAuto.webSocketServer.host;

    server.listen(port, host);
})()
    .then(() => {})
    .catch((err) => {
        logger.error('Failed to start', err);
    });
