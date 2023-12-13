import { type FrameHeader } from './FrameHeader.js';
import { DataBuffer } from '../utils/DataBuffer.js';

export interface FrameData {
    frameHeader: FrameHeader;
    payload: DataBuffer;
    totalSize: number;
}
