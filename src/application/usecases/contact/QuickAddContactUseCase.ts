import { Contact, ContactEntity } from '../../../domain/entities/Contact';
import { ContactRepository } from '../../../domain/repositories/ContactRepository';

/** Alphanumeric characters and dashes only */
const LICENSE_FORMAT = /^[A-Za-z0-9-]+$/;

export interface QuickAddContactInput {
  name: string;
  trade?: string;
  licenseNumber?: string;
  phone?: string;
  roles?: Contact['roles'];
}

export class QuickAddContactUseCase {
  constructor(private readonly repo: ContactRepository) {}

  async execute(input: QuickAddContactInput): Promise<Contact> {
    if (!input.name || !input.name.trim()) {
      throw new Error('name is required');
    }
    if (input.licenseNumber && !LICENSE_FORMAT.test(input.licenseNumber)) {
      throw new Error('licenseNumber must contain only alphanumeric characters and dashes');
    }

    const entity = ContactEntity.create({
      name: input.name.trim(),
      trade: input.trade,
      licenseNumber: input.licenseNumber,
      phone: input.phone,
      roles: input.roles,
      usageCount: 0,
    });

    const contact = entity.data();
    await this.repo.save(contact);
    return contact;
  }
}
