import { BluetoothProfile, BluetoothProfileEvents } from './BluetoothProfile';

export const ANDROID_AUTO_UUID = '4de17a00-52cb-11e6-bdf4-0800200c9a66';

const ANDROID_AUTO_RFCOMM_CHANNEL = 8;

export enum BluetoothServiceInfoUuid {
    SERVICE_CLASSS_IDS = 0x0001,
    SERVICE_ID = 0x0003,
    PROTOCOL_DESCRIPTOR_LIST = 0x0004,
    BROWSE_GROUP_LIST = 0x0005,
    BLUETOOTH_PROFILE_DESCTIPTOR_LIST = 0x0009,
    PRIMARY_LANGUAGE_BASE = 0x0100,
    SERVICE_NAME = PRIMARY_LANGUAGE_BASE + 0x0000,
    SERVICE_DESCRIPTION = PRIMARY_LANGUAGE_BASE + 0x0001,
    SERVICE_PROVIDER = PRIMARY_LANGUAGE_BASE + 0x0002,
}

export enum BluetoothServiceClassUuid {
    PUBLIC_BROWSE_GROUP = 0x1002,
    SERIAL_PORT = 0x1101,
}

export enum BluetoothProtocolUuid {
    RFCOMM = 0x0003,
    L2CAP = 0x0100,
}

const hex = (n: number, pad = 4) => `0x${n.toString(16).padStart(pad, '0')}`;

const ANDROID_AUTO_SERVICE_RECORD = `<?xml version="1.0"?>
<record>
    <attribute id="${hex(BluetoothServiceInfoUuid.SERVICE_CLASSS_IDS)}">
        <sequence>
            <uuid value="${ANDROID_AUTO_UUID}"/>
            <uuid value="${hex(BluetoothServiceClassUuid.SERIAL_PORT)}"/>
        </sequence>
    </attribute>
    <attribute id="${hex(BluetoothServiceInfoUuid.SERVICE_ID)}">
        <uuid value="${ANDROID_AUTO_UUID}"/>
    </attribute>
    <attribute id="${hex(BluetoothServiceInfoUuid.PROTOCOL_DESCRIPTOR_LIST)}">
        <sequence>
            <sequence>
                <uuid value="${hex(BluetoothProtocolUuid.L2CAP)}"/>
            </sequence>
            <sequence>
                <uuid value="${hex(BluetoothProtocolUuid.RFCOMM)}"/>
                <uint8 value="${hex(ANDROID_AUTO_RFCOMM_CHANNEL, 2)}"/>
            </sequence>
        </sequence>
    </attribute>
    <attribute id="${hex(BluetoothServiceInfoUuid.BROWSE_GROUP_LIST)}">
        <sequence>
            <uuid value="${hex(
                BluetoothServiceClassUuid.PUBLIC_BROWSE_GROUP,
            )}"/>
        </sequence>
    </attribute>
    <attribute id="${hex(
        BluetoothServiceInfoUuid.BLUETOOTH_PROFILE_DESCTIPTOR_LIST,
    )}">
        <sequence>
            <uuid value="${hex(BluetoothServiceClassUuid.SERIAL_PORT)}"/>
        </sequence>
    </attribute>
    <attribute id="${hex(BluetoothServiceInfoUuid.SERVICE_NAME)}">
        <text value="WebAuto Bluetooth Service" encoding="normal"/>
    </attribute>
    <attribute id="${hex(BluetoothServiceInfoUuid.SERVICE_DESCRIPTION)}">
        <text value="AndroidAuto WiFi projection automatic setup" encoding="normal"/>
    </attribute>
    <attribute id="${hex(BluetoothServiceInfoUuid.SERVICE_PROVIDER)}">
        <text value="WebAuto" encoding="normal"/>
    </attribute>
</record>`;

export class AndroidAutoProfile extends BluetoothProfile {
    public constructor(events: BluetoothProfileEvents) {
        super(
            ANDROID_AUTO_UUID,
            {
                Name: 'AA Wireless',
                Role: 'server',
                Channel: ANDROID_AUTO_RFCOMM_CHANNEL,
                ServiceRecord: ANDROID_AUTO_SERVICE_RECORD,
            },
            events,
        );
    }
}
