import { DelayReasonType } from '../../domain/entities/DelayReason';
import { DelayReasonTypeRepository } from '../../domain/repositories/DelayReasonTypeRepository';
import { getDatabase, initDatabase } from '../database/connection';

export class DrizzleDelayReasonTypeRepository implements DelayReasonTypeRepository {
  private initialized = false;

  private async ensureInitialized() {
    if (this.initialized) return;
    await initDatabase();
    this.initialized = true;
  }

  async findAll(): Promise<DelayReasonType[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql(
      'SELECT * FROM delay_reason_types WHERE is_active = 1 ORDER BY display_order ASC',
    );
    const types: DelayReasonType[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      types.push(this.mapRow(result.rows.item(i)));
    }
    return types;
  }

  async findById(id: string): Promise<DelayReasonType | null> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql(
      'SELECT * FROM delay_reason_types WHERE id = ?',
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows.item(0));
  }

  private mapRow(row: any): DelayReasonType {
    return {
      id: row.id,
      label: row.label,
      displayOrder: row.display_order,
      isActive: Boolean(row.is_active),
    };
  }
}
