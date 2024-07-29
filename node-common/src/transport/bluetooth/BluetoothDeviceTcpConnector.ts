import { Server } from 'node:net';
import { Duplex } from 'node:stream';

import { getLogger, LoggerWrapper } from '@web-auto/logging';

export class BluetoothDeviceTcpConnector {
    protected logger: LoggerWrapper;

    public constructor(
        private tcpServer: Server,
        private name: string,
    ) {
        this.logger = getLogger(`${this.constructor.name}@${this.name}`);
    }

    private async connect(abortSignal: AbortSignal): Promise<Duplex> {
        return new Promise<Duplex>((resolve, reject) => {
            const onAbort = () => {
                this.logger.info('Aborted wait for TCP connection');
                this.tcpServer.removeListener('connection', onConnect);
                reject(new Error('Aborted'));
            };

            const onConnect = (socket: Duplex) => {
                this.logger.info('Received TCP connection');
                abortSignal.removeEventListener('abort', onAbort);
                resolve(socket);
            };

            abortSignal.addEventListener('abort', onAbort);
            this.tcpServer.once('connection', onConnect);
        });
    }

    public async connectWithTimeout(timeoutMs: number): Promise<Duplex> {
        const abortSignal = AbortSignal.timeout(timeoutMs);

        return this.connect(abortSignal);
    }
}
