import type { PartialMessage } from '@bufbuild/protobuf';
import type { NetworkInfo, SocketInfoRequest } from './bluetooth_pb.js';

export type INetworkInfo = PartialMessage<NetworkInfo>;
export type ISocketInfoRequest = PartialMessage<SocketInfoRequest>;
