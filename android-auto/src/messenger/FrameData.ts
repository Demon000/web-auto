import { type FrameHeader } from './FrameHeader.js';

export interface FrameData {
    frameHeader: FrameHeader;
    payload: Uint8Array;
    totalSize: number;
}
