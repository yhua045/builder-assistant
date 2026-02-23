export interface Property {
  id: string;
  localId?: number; // SQLite INTEGER PRIMARY KEY
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  address?: string; // full address string
  propertyType?: 'residential' | 'commercial' | 'mixed';
  lotSize?: number;
  lotSizeUnit?: string;
  yearBuilt?: number;
  ownerId?: string; // contacts.id
  latitude?: number | null;
  longitude?: number | null;
  meta?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export class PropertyEntity {
  constructor(private readonly data: Property) {}

  static create(payload: Omit<Property, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): PropertyEntity {
    const id = payload.id ?? `prop_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const prop: Property = { ...payload, id, createdAt: now, updatedAt: now } as Property;
    return new PropertyEntity(prop);
  }

  dataPlain(): Property { return { ...this.data }; }
}
