import { inspect } from 'node:util';
import { format, transports, loggers, Logger } from 'winston';
import { resolve } from 'node:path';
import { type TransformableInfo } from 'logform';

export const LOGGER_NAME = 'logger';

const LOG_PATH = resolve(import.meta.dirname, '..', '..', '..');

type TransformableInfoWithMetadata = TransformableInfo & {
    metadata: {
        [key: string | symbol]: any;
    };
};

const printfCommon = (i: TransformableInfoWithMetadata, colors: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
    dirname: LOG_PATH,
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

export class LoggerWrapper {
    public constructor(
        private logger: Logger,
        public debuggable: boolean,
    ) {}

    public error(message: string, metadata?: any): void {
        this.logger.error(message, {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            metadata,
        });
    }

    public info(message: string, metadata?: any): void {
        this.logger.info(message, {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            metadata,
        });
    }

    public debug(message: string, metadata?: any): void {
        if (!this.debuggable) {
            return;
        }

        this.logger.debug(message, {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            metadata,
        });
    }
}

export const getLogger = (label: string): LoggerWrapper => {
    let debug;

    if (typeof config.debug === 'boolean') {
        debug = config.debug;
    } else {
        debug = config.debug.includes(label);
    }

    if (!loggers.has(label)) {
        loggers.add(label, {
            transports: [consoleTransport, fileTransport],
            level: 'debug',
            format: format.label({ label }),
        });
    }

    return new LoggerWrapper(loggers.get(label), debug);
};
