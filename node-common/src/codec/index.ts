import { MediaCodecType } from '@web-auto/android-auto-proto';
import { h264HasKeyFrame, parseH264CodecConfig } from './h264.js';
import { h265HasKeyFrame, parseH265CodecConfig } from './h265.js';
import type { CodecParsedConfig } from './codec.js';

export const parseCodecConfig = (
    videoCodecType: MediaCodecType,
    buffer: Uint8Array,
): CodecParsedConfig => {
    switch (videoCodecType) {
        case MediaCodecType.MEDIA_CODEC_VIDEO_H264_BP:
            return parseH264CodecConfig(buffer);
        case MediaCodecType.MEDIA_CODEC_VIDEO_H265:
            return parseH265CodecConfig(buffer);
        default:
            throw new Error(
                `Media codec ${MediaCodecType[videoCodecType]} unimplemented`,
            );
    }
};

export const hasKeyFrame = (
    videoCodecType: MediaCodecType,
    buffer: Uint8Array,
): boolean => {
    switch (videoCodecType) {
        case MediaCodecType.MEDIA_CODEC_VIDEO_H264_BP:
            return h264HasKeyFrame(buffer);
        case MediaCodecType.MEDIA_CODEC_VIDEO_H265:
            return h265HasKeyFrame(buffer);
        default:
            throw new Error(
                `Media codec ${MediaCodecType[videoCodecType]} unimplemented`,
            );
    }
};
