import type { PartialMessage } from '@bufbuild/protobuf';
import type {
    InputSourceService_TouchScreen,
    TouchEvent,
    VideoConfiguration,
} from './protos_pb.js';

export type ITouchEvent = PartialMessage<TouchEvent>;
export type IVideoConfiguration = PartialMessage<VideoConfiguration>;
export type IInputSourceService_TouchScreen =
    PartialMessage<InputSourceService_TouchScreen>;
