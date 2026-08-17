import { DelayReasonType } from '../entities/DelayReason.ts';

export interface DelayReasonTypeRepository {
  findAll(): Promise<DelayReasonType[]>;
  findById(id: string): Promise<DelayReasonType | null>;
}
