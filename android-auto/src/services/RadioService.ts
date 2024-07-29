import {
    type Service as ProtoService,
    RadioService as ProtoRadioService,
    RadioType,
} from '@web-auto/android-auto-proto';

import { Service, type ServiceEvents } from './Service.js';

export class RadioService extends Service {
    public constructor(events: ServiceEvents) {
        super(events);
    }

    protected override fillChannelDescriptor(
        channelDescriptor: ProtoService,
    ): void {
        channelDescriptor.radioService = new ProtoRadioService({
            radioProperties: [
                {
                    radioId: 0,
                    type: RadioType.FM_RADIO,
                    channelRange: [
                        {
                            min: 80,
                            max: 110,
                        },
                    ],
                    channelSpacing: 1,
                    channelSpacings: [1],
                },
            ],
        });
    }
}
