import { getLogger, setConfig } from '@web-auto/logging';
import { loadConfig } from '@web-auto/config-loader';
import { createAssert } from 'typia';
import {
    NodeAndroidAutoServerBuilder,
    type NodeCommonAndroidAutoConfig,
} from '@web-auto/node-common';
import { MessagePackIpcSerializer } from '@web-auto/socket-ipc/common.js';
import { SocketIpcServiceRegistrySocketHandler } from '@web-auto/socket-ipc/main.js';
import { Server, createServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { IpcServiceRegistry } from '@web-auto/common-ipc/main.js';

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

const startAndroidAuto = async (server: Server): Promise<void> => {
    if (config.androidAuto === undefined) {
        return;
    }

    const androidAutoIpcServiceRegistry = new IpcServiceRegistry([
        new SocketIpcServiceRegistrySocketHandler(
            new MessagePackIpcSerializer(),
            config.registryName,
            server,
        ),
    ]);

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
