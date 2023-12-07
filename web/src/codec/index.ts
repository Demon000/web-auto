import { androidAutoVideoService } from '../ipc.ts';
import { H264WebCodecsDecoder } from './H264WebCodecsDecoder.ts';

export const decoder = new H264WebCodecsDecoder();

androidAutoVideoService.on('data', (buffer) => {
    try {
        decoder.decode(buffer);
    } catch (err) {
        console.error(err);
    }
});

androidAutoVideoService.on('stop', () => {
    decoder.reset();
});