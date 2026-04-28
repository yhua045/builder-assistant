import { PaymentRepository } from '../../../domain/repositories/PaymentRepository';

/**
 * Returns the sum of all pending payment amounts globally,
 * optionally filtered by a contractor name search term.
 * Used to populate the "Total Amount Payable" banner in Firefighter mode.
 */
export class GetGlobalAmountPayableUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(contractorSearch?: string): Promise<number> {
    return this.repo.getGlobalAmountPayable(contractorSearch);
  }
}
