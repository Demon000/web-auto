import { FrameHeader } from './FrameHeader';
import { DataBuffer } from '@/utils/DataBuffer';

export interface FrameData {
    frameHeader: FrameHeader;
    payload: DataBuffer;
    totalSize: number;
}
