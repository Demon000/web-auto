import {
    MediaCodecType,
    VideoCodecResolutionType,
    VideoFrameRateType,
} from '@web-auto/android-auto-proto';
import type {
    IInsets,
    IVideoConfiguration,
} from '@web-auto/android-auto-proto/interfaces.js';

export interface ResolutionConfig {
    resolution: VideoCodecResolutionType;
    codec: MediaCodecType;
    framerate: VideoFrameRateType;
}

export interface DisplayConfig {
    width: number;
    height: number;
    density: number;
}

export class VideoResolutionUtils {
    private static getSupportedResolutions(
        resolutionConfigs: ResolutionConfig[],
    ): VideoCodecResolutionType[] {
        const resolutions = new Set<VideoCodecResolutionType>();

        for (const resolutionConfig of resolutionConfigs) {
            resolutions.add(resolutionConfig.resolution);
        }

        return Array.from(resolutions);
    }

    private static resolutionToSize(
        resolution: VideoCodecResolutionType,
    ): [number, number] {
        switch (resolution) {
            case VideoCodecResolutionType.VIDEO_800x480:
                return [800, 480];
            case VideoCodecResolutionType.VIDEO_1280x720:
                return [1280, 720];
            case VideoCodecResolutionType.VIDEO_1920x1080:
                return [1920, 1080];
            case VideoCodecResolutionType.VIDEO_2560x1440:
                return [2560, 1440];
            case VideoCodecResolutionType.VIDEO_3840x2160:
                return [3840, 2160];
            case VideoCodecResolutionType.VIDEO_720x1280:
                return [720, 1280];
            case VideoCodecResolutionType.VIDEO_1080x1920:
                return [1080, 1920];
            case VideoCodecResolutionType.VIDEO_1440x2560:
                return [1440, 2560];
            case VideoCodecResolutionType.VIDEO_2160x3840:
                return [2160, 3840];
            default:
                throw new Error(
                    `Invalid resolution: ${VideoCodecResolutionType[resolution]}`,
                );
        }
    }

    private static getResolutionMargins(
        resolution: VideoCodecResolutionType,
        displayConfig: DisplayConfig,
        scale: number,
    ): IInsets {
        const [width, height] = this.resolutionToSize(resolution);
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        const remainingWidth = scaledWidth - displayConfig.width;
        const remainingHeight = scaledHeight - displayConfig.height;
        const remainingUnscaledWidth = Math.round(remainingWidth / scale);
        const remainingUnscaledHeight = Math.round(remainingHeight / scale);

        return {
            left: 0,
            right: remainingUnscaledWidth,
            top: 0,
            bottom: remainingUnscaledHeight,
        };
    }

    private static getResolutionRatio(
        resolution: VideoCodecResolutionType,
        displayConfig: DisplayConfig,
        cover: boolean,
    ): number {
        const [width, height] = this.resolutionToSize(resolution);

        const widthRatio = displayConfig.width / width;
        const heightRatio = displayConfig.height / height;

        return cover ? 1 : Math.max(widthRatio, heightRatio);
    }

    private static canSizeFitResolution(
        width: number,
        height: number,
        resolution: VideoCodecResolutionType,
    ): boolean {
        const [resolutionWidth, resolutionHeight] =
            this.resolutionToSize(resolution);

        return resolutionWidth >= width && resolutionHeight >= height;
    }

    private static isResolutionSmaller(
        resolution: VideoCodecResolutionType,
        thanResolution: VideoCodecResolutionType,
    ): boolean {
        const [thanWidth, thanHeight] = this.resolutionToSize(thanResolution);
        const [width, height] = this.resolutionToSize(resolution);

        return (
            (width < thanWidth && height < thanHeight) ||
            (width === thanWidth && height < thanHeight) ||
            (width < thanWidth && height === thanHeight)
        );
    }

    private static findBestResolution(
        displayConfig: DisplayConfig,
        supportedResolutions: VideoCodecResolutionType[],
    ): VideoCodecResolutionType | undefined {
        let bestResolution;

        for (const resolution of supportedResolutions) {
            if (
                !this.canSizeFitResolution(
                    displayConfig.width,
                    displayConfig.height,
                    resolution,
                )
            ) {
                continue;
            }

            if (
                bestResolution !== undefined &&
                !this.isResolutionSmaller(resolution, bestResolution)
            ) {
                continue;
            }

            bestResolution = resolution;
        }

        return bestResolution;
    }

    private static findSmallerResolutions(
        bigResolution: VideoCodecResolutionType | undefined,
        supportedResolutions: VideoCodecResolutionType[],
    ): VideoCodecResolutionType[] {
        const foundResolutions = [];

        for (const resolution of supportedResolutions) {
            if (
                bigResolution !== undefined &&
                !this.isResolutionSmaller(resolution, bigResolution)
            ) {
                continue;
            }

            foundResolutions.push(resolution);
        }

        return foundResolutions;
    }

    private static getVideoResolutionConfigs(
        resolution: VideoCodecResolutionType,
        displayConfig: DisplayConfig,
        resolutionConfigs: ResolutionConfig[],
        cover: boolean,
    ): IVideoConfiguration[] {
        const configs: IVideoConfiguration[] = [];

        const ratio = this.getResolutionRatio(resolution, displayConfig, cover);

        const dpi = Math.round(displayConfig.density / ratio);

        const margins = this.getResolutionMargins(
            resolution,
            displayConfig,
            ratio,
        );

        for (const resolutionConfig of resolutionConfigs) {
            if (resolution !== resolutionConfig.resolution) {
                continue;
            }

            configs.push({
                codecResolution: resolution,
                density: dpi,
                frameRate: resolutionConfig.framerate,
                videoCodecType: resolutionConfig.codec,
                uiConfig: {
                    margins,
                },
            });
        }

        return configs;
    }

    public static getVideoConfigs(
        displayConfig: DisplayConfig,
        resolutionConfigs: ResolutionConfig[],
    ): IVideoConfiguration[] {
        const supportedResolutions =
            this.getSupportedResolutions(resolutionConfigs);
        const configs: IVideoConfiguration[] = [];

        /*
         * Find the smallest resolution that is at least equal to
         * the display resolution.
         */
        const bestResolution = this.findBestResolution(
            displayConfig,
            supportedResolutions,
        );

        if (bestResolution !== undefined) {
            const resolutionVideoConfigs = this.getVideoResolutionConfigs(
                bestResolution,
                displayConfig,
                resolutionConfigs,
                true,
            );

            configs.push(...resolutionVideoConfigs);
        }

        /*
         * Find all resolutions smaller than the best resolution.
         */
        const smallerResolutions = this.findSmallerResolutions(
            bestResolution,
            supportedResolutions,
        );
        for (const smallResolution of smallerResolutions) {
            const resolutionVideoConfigs = this.getVideoResolutionConfigs(
                smallResolution,
                displayConfig,
                resolutionConfigs,
                false,
            );
            configs.push(...resolutionVideoConfigs);
        }

        return configs;
    }
}
