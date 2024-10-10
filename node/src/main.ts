import { readFileSync } from 'node:fs';
import { createServer, Server } from 'node:https';

import { IpcServiceRegistry } from '@web-auto/common-ipc/main.js';
import { loadConfig } from '@web-auto/config-loader';
import { getLogger, setConfig } from '@web-auto/logging';
import {
    NodeAndroidAutoServerBuilder,
    type NodeCommonAndroidAutoConfig,
} from '@web-auto/node-common';
import { MessagePackIpcSerializer } from '@web-auto/socket-ipc/common.js';
import { SocketIpcServiceRegistrySocketHandler } from '@web-auto/socket-ipc/main.js';
import SegfaultHandler from 'segfault-handler';
import { createAssert } from 'typia';

export type NodeAndroidAutoConfig = {
    nodeAndroidAuto: {
        webSocketServer: {
            port: number;
            host: string;
        };
    };
} & NodeCommonAndroidAutoConfig;

const configAssert = createAssert<NodeAndroidAutoConfig>();

const config = loadConfig<NodeAndroidAutoConfig>(configAssert);

setConfig(config.logging);

const logger = getLogger('node');

logger.info('Config', config);

SegfaultHandler.registerHandler('crash.log', function (signal, address, stack) {
    logger.error('Segafault', {
        signal,
        address,
        stack,
    });
});

const startAndroidAuto = async (server: Server): Promise<void> => {
    if (config.androidAuto === undefined) {
        return;
    }

    const androidAutoIpcServiceRegistry = new IpcServiceRegistry((events) => {
        return [
            new SocketIpcServiceRegistrySocketHandler(
                new MessagePackIpcSerializer(),
                config.registryName,
                server,
                events,
            ),
        ];
    });

    androidAutoIpcServiceRegistry.register();

    const builder = new NodeAndroidAutoServerBuilder(
        androidAutoIpcServiceRegistry,
        config.androidAuto,
    );

    const androidAutoServer = builder.buildAndroidAutoServer();

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
