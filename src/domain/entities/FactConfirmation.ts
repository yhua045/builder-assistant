export type FactConfirmationDecision = 'accepted' | 'rejected' | 'needs_review';

export interface FactConfirmation {
  id: string;
  factId: string;
  decision: FactConfirmationDecision;
  confirmedBy: string;
  reason?: string;
  confirmedAt: Date;
}

export class FactConfirmationEntity {
  private constructor(private readonly confirmation: FactConfirmation) {}

  static create(payload: FactConfirmation): FactConfirmationEntity {
    FactConfirmationEntity.validate(payload);
    return new FactConfirmationEntity({ ...payload });
  }

  static fromData(confirmation: FactConfirmation): FactConfirmationEntity {
    FactConfirmationEntity.validate(confirmation);
    return new FactConfirmationEntity({ ...confirmation });
  }

  data(): FactConfirmation {
    return { ...this.confirmation };
  }

  private static validate(confirmation: FactConfirmation): void {
    if (!confirmation.id || confirmation.id.trim().length === 0) {
      throw new Error('FactConfirmation id is required');
    }
    if (!confirmation.factId || confirmation.factId.trim().length === 0) {
      throw new Error('FactConfirmation factId is required');
    }
    if (!confirmation.confirmedBy || confirmation.confirmedBy.trim().length === 0) {
      throw new Error('FactConfirmation confirmedBy is required');
    }
    if (!confirmation.confirmedAt || Number.isNaN(confirmation.confirmedAt.getTime())) {
      throw new Error('FactConfirmation confirmedAt is required');
    }
  }
}
