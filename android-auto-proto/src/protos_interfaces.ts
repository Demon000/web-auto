import type { PartialMessage } from '@bufbuild/protobuf';
import type {
    AudioConfiguration,
    InputSourceService_TouchScreen,
    MediaPlaybackMetadata,
    MediaPlaybackStatus,
    TouchEvent,
    VideoConfiguration,
    VideoFocusNotification,
    VideoFocusRequestNotification,
} from './protos_pb.js';

export type ITouchEvent = PartialMessage<TouchEvent>;
export type IVideoConfiguration = PartialMessage<VideoConfiguration>;
export type IAudioConfiguration = PartialMessage<AudioConfiguration>;
export type IInputSourceService_TouchScreen =
    PartialMessage<InputSourceService_TouchScreen>;
export type IVideoFocusNotification = PartialMessage<VideoFocusNotification>;
export type IVideoFocusRequestNotification =
    PartialMessage<VideoFocusRequestNotification>;
export type IMediaPlaybackMetadata = PartialMessage<MediaPlaybackMetadata>;
export type IMediaPlaybackStatus = PartialMessage<MediaPlaybackStatus>;
