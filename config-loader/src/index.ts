import JSON5 from 'json5';
import { readFileSync } from 'fs';
import { resolve } from 'node:path';
import type { JsonObject, JsonValue, WritableDeep } from 'type-fest';

export type Value = WritableDeep<JsonValue>;
export type Config = WritableDeep<JsonObject>;
export type Variables = WritableDeep<JsonObject>;

export type VariableConfig = {
    variables?: Variables;
} & Config;

const CONFIG_PATH = resolve(
    import.meta.dirname,
    '..',
    '..',
    '..',
    'config.json5',
);

const lookupVariable = (
    name: string,
    variables: Variables,
): Exclude<Value, undefined | null> => {
    const value = variables[name];
    if (value === undefined || value === null) {
        throw new Error(`Failed to find value for variable ${name}`);
    }

    return value;
};

const lookupInterpolableVariable = (
    name: string,
    variables: Variables,
): string | number => {
    const value = lookupVariable(name, variables);
    if (typeof value !== 'string' && typeof value !== 'number') {
        throw new Error(`Invalid value for variable ${name}`);
    }

    return value;
};

const interpolateVariableMatch = (
    match: RegExpMatchArray,
    value: string,
    variables: Variables,
): string => {
    const variableNameMatch = match[0];

    const variableName = match[1];
    if (variableName === undefined) {
        return value;
    }

    const variableValue = lookupInterpolableVariable(variableName, variables);

    return value.replace(variableNameMatch, variableValue.toString());
};

const interpolateVariable = (value: string, variables: Variables): string => {
    const matches = value.matchAll(/\$\{(\S+?)\}/g);

    for (const match of matches) {
        value = interpolateVariableMatch(match, value, variables);
    }

    return value;
};

const fixVariable = (value: Value, variables: Variables): Value => {
    if (typeof value !== 'string') {
        return value;
    }

    const interpolateMarker = '`';
    if (
        value.startsWith(interpolateMarker) &&
        value.endsWith(interpolateMarker)
    ) {
        const template = value.slice(
            interpolateMarker.length,
            value.length - interpolateMarker.length,
        );

        return interpolateVariable(template, variables);
    }

    const replaceMarker = '=';
    if (value.startsWith(replaceMarker)) {
        const variableName = value.slice(replaceMarker.length);
        return lookupVariable(variableName, variables);
    }

    return value;
};

const fixVariables = (value: Value, variables: Variables): Value => {
    if (Array.isArray(value)) {
        for (const [key, v] of value.entries()) {
            value[key] = fixVariables(v, variables);
        }
    } else if (value !== null && typeof value === 'object') {
        for (const [key, v] of Object.entries(value)) {
            value[key] = fixVariables(v, variables);
        }
    } else {
        return fixVariable(value, variables);
    }

    return value;
};

export const loadConfig = <T>(assertFn: (input: unknown) => T): T => {
    const configString = readFileSync(CONFIG_PATH, 'utf8');
    const config = JSON5.parse<VariableConfig>(configString);

    const variables = config['variables'];
    delete config['variables'];
    if (variables !== undefined) {
        fixVariables(config, variables);
    }

    return assertFn(config);
};
