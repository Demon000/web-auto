import { type FrameHeader } from './FrameHeader.js';

export interface FrameData {
    frameHeader: FrameHeader;
    payload: DataBuffer;
    totalSize: number;
}
