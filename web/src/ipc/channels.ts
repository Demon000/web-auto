import { AndroidAutoCommuncationChannel } from './android-auto-ipc.js';
import { WebConfigCommuncationChannel } from './config-ipc.js';

export const androidAutoChannel = new AndroidAutoCommuncationChannel();
export const webConfigChannel = new WebConfigCommuncationChannel();
