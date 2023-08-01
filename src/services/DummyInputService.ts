import { BindingRequest } from '../proto/types';
import { InputService } from './InputService';

export class DummyInputService extends InputService {
    protected async bind(_data: BindingRequest): Promise<void> {
        // TODO
    }
}
