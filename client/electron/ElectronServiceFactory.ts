import {
    ControlService,
    DummyAudioInputService,
    DummyAudioOutputService,
    DummyInputService,
    DummyMediaStatusService,
    DummyNavigationStatusService,
    DummySensorService,
    ServiceFactory,
} from '@web-auto/server';
import { MessageInStream } from '@web-auto/server';
import { MessageOutStream } from '@web-auto/server';
import { Service } from '@web-auto/server';
import { ICryptor } from '@web-auto/server';
import { ChannelId } from '@web-auto/server';
import { WebSocketServer } from 'ws';
import {
    ElectronVideoService,
    ElectronVideoServiceEvent,
} from './ElectronVideoService';

export class ElectronServiceFactory extends ServiceFactory {
    public constructor(private wss: WebSocketServer) {
        super();
    }

    public buildControlService(
        cryptor: ICryptor,
        services: Service[],
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ): ControlService {
        return new ControlService(
            cryptor,
            services,
            messageInStream,
            messageOutStream,
        );
    }

    public buildServices(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ): Service[] {
        const videoService = new ElectronVideoService(
            messageInStream,
            messageOutStream,
        );

        const services: Service[] = [
            new DummyAudioInputService(messageInStream, messageOutStream),
            new DummyAudioOutputService(
                ChannelId.MEDIA_AUDIO,
                messageInStream,
                messageOutStream,
            ),
            new DummyAudioOutputService(
                ChannelId.SPEECH_AUDIO,
                messageInStream,
                messageOutStream,
            ),
            new DummyAudioOutputService(
                ChannelId.SYSTEM_AUDIO,
                messageInStream,
                messageOutStream,
            ),
            new DummySensorService(messageInStream, messageOutStream),
            videoService,
            new DummyNavigationStatusService(messageInStream, messageOutStream),
            new DummyMediaStatusService(messageInStream, messageOutStream),
            new DummyInputService(messageInStream, messageOutStream),
        ];

        videoService.emitter.on(ElectronVideoServiceEvent.DATA, (buffer) => {
            this.wss.clients.forEach((socket) => {
                socket.send(buffer.data);
            });
        });

        return services;
    }
}
