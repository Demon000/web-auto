import { DecoderWorker } from './codec/DecoderWorkerWrapper.js';
import { WEB_CONFIG } from './config.js';

const decoders = new Map<string, DecoderWorker>();

export const initializeDecoders = () => {
    for (const config of WEB_CONFIG.decoders) {
        const decoder = new DecoderWorker(config);
        decoders.set(config.videoServiceIpcName, decoder);
        decoder.start();
    }
};

export const getDecoder = (name: string): DecoderWorker => {
    const decoder = decoders.get(name);
    if (decoder === undefined) {
        throw new Error(`Failed to find decoder with name ${name}`);
    }

    return decoder;
};
