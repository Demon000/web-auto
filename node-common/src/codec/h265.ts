import type { VideoCodecConfig } from '@web-auto/android-auto-ipc';
import {
    annexBSplitNalu,
    h265ParseConfiguration,
    h265ParseNaluHeader,
} from '@yume-chan/scrcpy';

export const toUint32Le = (data: Uint8Array, offset: number) => {
    return (
        data[offset]! |
        (data[offset + 1]! << 8) |
        (data[offset + 2]! << 16) |
        (data[offset + 3]! << 24)
    );
};

export const h265HasKeyFrame = (buffer: Uint8Array) => {
    for (const nalu of annexBSplitNalu(buffer)) {
        const header = h265ParseNaluHeader(nalu);

        if (header.nal_unit_type === 19 || header.nal_unit_type === 20) {
            return true;
        }
    }

    return false;
};

export const parseH265CodecConfig = (buffer: Uint8Array): VideoCodecConfig => {
    const {
        generalProfileSpace,
        generalProfileIndex,
        generalProfileCompatibilitySet,
        generalTierFlag,
        generalLevelIndex,
        generalConstraintSet,
        cropLeft,
        cropRight,
        cropTop,
        cropBottom,
        croppedWidth,
        croppedHeight,
    } = h265ParseConfiguration(buffer);

    const codec = [
        'hev1',
        ['', 'A', 'B', 'C'][generalProfileSpace]! +
            generalProfileIndex.toString(),
        toUint32Le(generalProfileCompatibilitySet, 0).toString(16),
        (generalTierFlag ? 'H' : 'L') + generalLevelIndex.toString(),
        toUint32Le(generalConstraintSet, 0).toString(16).toUpperCase(),
        toUint32Le(generalConstraintSet, 4).toString(16).toUpperCase(),
    ].join('.');

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
