import type { PartialMessage } from '@bufbuild/protobuf';
import type {
    AudioConfiguration,
    HeadUnitInfo,
    InputSourceService_TouchScreen,
    KeyEvent,
    MediaPlaybackMetadata,
    MediaPlaybackStatus,
    ServiceDiscoveryResponse,
    TouchEvent,
    VideoConfiguration,
    VideoFocusNotification,
    VideoFocusRequestNotification,
} from './protos_pb.js';

export type ITouchEvent = PartialMessage<TouchEvent>;
export type IKeyEvent = PartialMessage<KeyEvent>;
export type IVideoConfiguration = PartialMessage<VideoConfiguration>;
export type IAudioConfiguration = PartialMessage<AudioConfiguration>;
export type IInputSourceService_TouchScreen =
    PartialMessage<InputSourceService_TouchScreen>;
export type IVideoFocusNotification = PartialMessage<VideoFocusNotification>;
export type IVideoFocusRequestNotification =
    PartialMessage<VideoFocusRequestNotification>;
export type IMediaPlaybackMetadata = PartialMessage<MediaPlaybackMetadata>;
export type IMediaPlaybackStatus = PartialMessage<MediaPlaybackStatus>;
export type IServiceDiscoveryResponse =
    PartialMessage<ServiceDiscoveryResponse>;
export type IHeadUnitInfo = PartialMessage<HeadUnitInfo>;
