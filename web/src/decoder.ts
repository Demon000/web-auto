import { DecoderWorker } from './codec/DecoderWorkerWrapper.ts';
import { androidAutoVideoService } from './ipc.ts';

export const decoder = new DecoderWorker(androidAutoVideoService);
