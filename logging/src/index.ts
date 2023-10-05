import { join } from 'node:path';
import { inspect } from 'node:util';
import { format, transports, loggers } from 'winston';
import { TransformableInfo } from 'logform';

export const LOGGER_NAME = 'logger';

type TransformableInfoWithMetadata = TransformableInfo & {
    metadata: {
        [key: string | symbol]: any;
    };
};

const printfCommon = (i: TransformableInfoWithMetadata, colors: boolean) => {
    const { timestamp, level, label, message, metadata } = i;
    let m;
    if (metadata !== undefined && Object.keys(metadata).length !== 0) {
        m =
            '\n' +
            inspect(metadata, { showHidden: false, depth: null, colors });
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
    debug: boolean;
}

let config: LoggingConfig = {
    debug: false,
};

export const setConfig = (newConfig: LoggingConfig) => {
    config = newConfig;
};

export const getLogger = (label: string) => {
    if (!loggers.has(label)) {
        loggers.add(label, {
            transports: [consoleTransport, fileTransport],
            level: config.debug ? 'debug' : 'info',
            format: format.label({ label }),
        });
    }

    return loggers.get(label);
};
