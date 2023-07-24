export interface ITransport {
    receive(size: number): Promise<Buffer>;
    send(buffer: Buffer): Promise<Buffer>;
}
