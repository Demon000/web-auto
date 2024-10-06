import { annexBSplitNalu, h264ParseConfiguration } from '@yume-chan/scrcpy';

import { toHex } from '../utils.js';
import type { CodecParsedConfig } from './codec.js';

export const h264HasKeyFrame = (buffer: Uint8Array) => {
    for (const nalu of annexBSplitNalu(buffer)) {
        const naluType = nalu[0]! & 0x1f;

        if (naluType === 5) {
            return true;
        }
    }

    return false;
};

export const parseH264CodecConfig = (buffer: Uint8Array): CodecParsedConfig => {
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
        .map((num) => toHex(num, 2))
        .join('')}`;

    return {
        codec,
        cropLeft,
        cropRight,
        cropTop,
        cropBottom,
        croppedWidth,
        croppedHeight,
    };
};
