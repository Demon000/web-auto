import { join } from 'node:path';
import { inspect } from 'node:util';
import { format, transports, loggers, Logger } from 'winston';
import { type TransformableInfo } from 'logform';

export const LOGGER_NAME = 'logger';

import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

type TransformableInfoWithMetadata = TransformableInfo & {
    metadata: {
        [key: string | symbol]: any;
    };
};

const printfCommon = (i: TransformableInfoWithMetadata, colors: boolean) => {
    const { timestamp, level, label, message, metadata } = i;
    let m;
    if (metadata !== undefined) {
        m =
            '\n' +
            inspect(metadata, {
                sorted: true,
                showHidden: false,
                depth: null,
                maxArrayLength: null,
                maxStringLength: null,
                colors,
            });
    } else {
        m = '';
    }
    return `${timestamp} ${level} [${label}] ${message}${m}`;
};

const printfConsole = (i: TransformableInfo) => {
    return printfCommon(i as TransformableInfoWithMetadata, true);
};

const printfFile = (i: TransformableInfo) => {
    return printfCommon(i as TransformableInfoWithMetadata, false);
};

const consoleTransport = new transports.Console({
    format: format.combine(
        format.timestamp(),
        format.cli(),
        format.colorize(),
        format.errors({ stack: true }),
        format.printf(printfConsole),
    ),
});

consoleTransport.setMaxListeners(Infinity);

const fileTransport = new transports.File({
    options: { flags: 'w' },
    format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.printf(printfFile),
    ),
    dirname: join(__dirname, '..', '..'),
    filename: 'web-auto.log',
});

fileTransport.setMaxListeners(Infinity);

export interface LoggingConfig {
    debug: boolean | string[];
}

let config: LoggingConfig = {
    debug: false,
};

export const setConfig = (newConfig: LoggingConfig) => {
    config = newConfig;
};

export const getLogger = (label: string): Logger => {
    if (!loggers.has(label)) {
        let debug;

        if (typeof config.debug === 'boolean') {
            debug = config.debug;
        } else {
            debug = config.debug.includes(label);
        }

        loggers.add(label, {
            transports: [consoleTransport, fileTransport],
            level: debug ? 'debug' : 'info',
            format: format.label({ label }),
        });
    }

    return loggers.get(label);
};
