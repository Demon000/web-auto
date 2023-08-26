import { AndroidAutoCommuncationChannel } from './android-auto-ipc';
import { WebConfigCommuncationChannel } from './config-ipc';

export const androidAutoChannel = new AndroidAutoCommuncationChannel();
export const webConfigChannel = new WebConfigCommuncationChannel();
