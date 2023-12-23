import { DecoderWorker } from './codec/DecoderWorkerWrapper.ts';
import { androidAutoClusterVideoService } from './ipc.ts';

export const decoder = new DecoderWorker(androidAutoClusterVideoService);
