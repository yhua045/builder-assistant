export type RoleType = 'INSPECTOR' | 'CONTRACTOR' | 'VENDOR' | 'OWNER' | 'OTHER';

export interface Contact {
  id: string;
  localId?: number; // SQLite INTEGER PRIMARY KEY
  name: string;
  roles?: RoleType[];
  trade?: string;
  phone?: string;
  email?: string;
  address?: string;
  rate?: number;
  notes?: string;
  licenseNumber?: string;  // builder/contractor registration number (issue #171)
  usageCount?: number;    // times selected across all projects (issue #171, default 0)
  createdAt?: string;
  updatedAt?: string;
}

export class ContactEntity {
  constructor(private readonly contact: Contact) {}

  static create(payload: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): ContactEntity {
    const id = payload.id ?? `contact_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const contact: Contact = { ...payload, id, createdAt: now, updatedAt: now } as Contact;
    return new ContactEntity(contact);
  }

  data(): Contact { return { ...this.contact }; }
}
