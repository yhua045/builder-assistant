import { Contact } from '../../../domain/entities/Contact';
import { ContactRepository } from '../../../domain/repositories/ContactRepository';

export interface GetSuggestedContractorsInput {
  limit?: number;
  roleFilter?: string;
}

export class GetSuggestedContractorsUseCase {
  constructor(private readonly repo: ContactRepository) {}

  async execute(input: GetSuggestedContractorsInput = {}): Promise<Contact[]> {
    const limit = input.limit ?? 20;
    let contacts = await this.repo.findMostUsed(limit);

    if (input.roleFilter) {
      contacts = contacts.filter(
        (c) => c.roles?.includes(input.roleFilter as any) ?? true,
      );
    }

    if (contacts.length === 0) {
      const all = await this.repo.findAll();
      contacts = input.roleFilter
        ? all.filter((c) => c.roles?.includes(input.roleFilter as any) ?? true)
        : all;
      contacts = contacts.slice(0, limit);
    }

    return contacts;
  }
}
