import { androidAutoVideoService } from '../ipc.ts';
import { H264WebCodecsDecoder } from './H264WebCodecsDecoder.ts';

export const decoder = new H264WebCodecsDecoder();

androidAutoVideoService.on('codecConfig', (config) => {
    try {
        decoder.configure(config.codec);
    } catch (err) {
        console.error(err);
    }
});

androidAutoVideoService.on('firstFrame', (buffer) => {
    try {
        decoder.decodeKeyFrame(buffer);
    } catch (err) {
        console.error(err);
    }
});

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
