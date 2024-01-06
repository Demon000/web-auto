import type { VideoCodecConfig } from '@web-auto/android-auto-ipc';
import { annexBSplitNalu, h264ParseConfiguration } from '@yume-chan/scrcpy';

const toHex = (value: number) =>
    value.toString(16).padStart(2, '0').toUpperCase();

export const h264HasKeyFrame = (buffer: Uint8Array) => {
    for (const nalu of annexBSplitNalu(buffer)) {
        const naluType = nalu[0]! & 0x1f;

        if (naluType === 5) {
            return true;
        }
    }

    return false;
};

export const parseH264CodecConfig = (buffer: Uint8Array): VideoCodecConfig => {
    const {
        profileIndex,
        constraintSet,
        levelIndex,
        cropLeft,
        cropRight,
        cropTop,
        cropBottom,
        croppedWidth,
        croppedHeight,
    } = h264ParseConfiguration(buffer);

    const codec = `avc1.${[profileIndex, constraintSet, levelIndex]
        .map(toHex)
        .join('')}`;

    return {
        codec,
        cropLeft,
        cropRight,
        cropTop,
        cropBottom,
        width: croppedWidth,
        height: croppedHeight,
    };
};
