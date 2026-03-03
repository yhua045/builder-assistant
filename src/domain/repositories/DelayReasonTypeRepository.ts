import { DelayReasonType } from '../entities/DelayReason';

export interface DelayReasonTypeRepository {
  findAll(): Promise<DelayReasonType[]>;
  findById(id: string): Promise<DelayReasonType | null>;
}
