import { proto2, type EnumType, type PartialMessage } from '@bufbuild/protobuf';

import {
    AudioStreamType,
    DisplayType,
    KeyCode,
    MediaCodecType,
    TouchScreenType,
    VideoFrameRateType,
    type AudioConfiguration,
    type HeadUnitInfo,
    type MediaPlaybackMetadata,
    type MediaPlaybackStatus,
    type ServiceDiscoveryResponse,
    type TouchEvent,
    type VideoConfiguration,
    type VideoFocusNotification,
    type VideoFocusRequestNotification,
} from './protos_pb.js';
import { VideoCodecResolutionType } from './protos_pb.js';

export type ITouchEvent = PartialMessage<TouchEvent>;
export type IVideoConfiguration = PartialMessage<VideoConfiguration>;
export type IAudioConfiguration = PartialMessage<AudioConfiguration>;
export type IVideoFocusNotification = PartialMessage<VideoFocusNotification>;
export type IVideoFocusRequestNotification =
    PartialMessage<VideoFocusRequestNotification>;
export type IMediaPlaybackMetadata = PartialMessage<MediaPlaybackMetadata>;
export type IMediaPlaybackStatus = PartialMessage<MediaPlaybackStatus>;
export type IServiceDiscoveryResponse =
    PartialMessage<ServiceDiscoveryResponse>;
export type IHeadUnitInfo = PartialMessage<HeadUnitInfo>;
export type IInsets = {
    top: number;
    bottom: number;
    left: number;
    right: number;
};

const stringToEnumValue = (
    enumType: EnumType,
    value: string | number,
    prefixes?: string[],
    numberMap?: Map<number, number>,
): number => {
    let info;

    if (typeof value === 'number') {
        if (numberMap !== undefined) {
            const mappedValue = numberMap.get(value);
            if (mappedValue !== undefined) {
                value = mappedValue;
            }
        }
        info = enumType.findNumber(value);
    } else {
        info = enumType.findName(value);
        if (info === undefined && prefixes !== undefined) {
            for (const prefix of prefixes) {
                info = enumType.findName(`${prefix}${value}`);
                if (info !== undefined) {
                    break;
                }
            }
        }
    }

    if (info !== undefined) {
        return info.no;
    }

    throw new Error(`Failed to find enum value for string ${value}`);
};

export const stringToKeycode = (value: string | KeyCode): KeyCode => {
    const enumType = proto2.getEnumType(KeyCode);
    return stringToEnumValue(enumType, value, ['KEYCODE_']);
};

export const stringToResolution = (
    value: string | VideoCodecResolutionType,
): VideoCodecResolutionType => {
    const enumType = proto2.getEnumType(VideoCodecResolutionType);
    return stringToEnumValue(enumType, value, ['VIDEO_']);
};

export const stringToCodec = (
    value: string | MediaCodecType,
): MediaCodecType => {
    const enumType = proto2.getEnumType(MediaCodecType);
    return stringToEnumValue(enumType, value, [
        'MEDIA_CODEC_',
        'MEDIA_CODEC_VIDEO_',
        'MEDIA_CODEC_AUDIO_',
    ]);
};

export const stringToFramerate = (
    value: string | number | VideoFrameRateType,
): VideoFrameRateType => {
    const enumType = proto2.getEnumType(VideoFrameRateType);
    return stringToEnumValue(
        enumType,
        value,
        ['VIDEO_FPS_'],
        new Map([
            [60, VideoFrameRateType.VIDEO_FPS_60],
            [30, VideoFrameRateType.VIDEO_FPS_30],
        ]),
    );
};

export const stringToDisplayType = (
    value: string | DisplayType,
): DisplayType => {
    const enumType = proto2.getEnumType(DisplayType);
    return stringToEnumValue(enumType, value, ['DISPLAY_TYPE_']);
};

export const stringToAudioStreamType = (
    value: string | AudioStreamType,
): AudioStreamType => {
    const enumType = proto2.getEnumType(AudioStreamType);
    return stringToEnumValue(enumType, value, ['AUDIO_STREAM_']);
};

export const stringToTouchscreenType = (
    value: string | TouchScreenType,
): TouchScreenType => {
    const enumType = proto2.getEnumType(TouchScreenType);
    return stringToEnumValue(enumType, value);
};
