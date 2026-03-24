import { ContactEntity } from '../../../domain/entities/Contact';
import { ContactRepository } from '../../../domain/repositories/ContactRepository';

export interface RowError {
  row: number;  // 1-based data row number (header = row 1)
  reason: string;
}

export interface ImportSummary {
  totalRows: number;
  imported: number;
  errors: RowError[];
}

export class ImportContractorsFromCsvUseCase {
  constructor(private readonly repo: ContactRepository) {}

  async execute(csvText: string): Promise<ImportSummary> {
    const lines = csvText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) {
      return { totalRows: 0, imported: 0, errors: [] };
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIdx = headers.indexOf('name');
    if (nameIdx === -1) {
      throw new Error('CSV must contain a "name" column');
    }
    const tradeIdx = headers.indexOf('trade');
    const licenseIdx = headers.indexOf('licensenumber');
    const phoneIdx = headers.indexOf('phone');

    const dataLines = lines.slice(1);
    const errors: RowError[] = [];
    let imported = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const cols = dataLines[i].split(',').map((c) => c.trim());
      const rowNum = i + 2; // 1-based, header is row 1
      const name = cols[nameIdx] ?? '';

      if (!name) {
        errors.push({ row: rowNum, reason: 'name is required' });
        continue;
      }

      const entity = ContactEntity.create({
        name,
        trade: tradeIdx !== -1 ? cols[tradeIdx] || undefined : undefined,
        licenseNumber: licenseIdx !== -1 ? cols[licenseIdx] || undefined : undefined,
        phone: phoneIdx !== -1 ? cols[phoneIdx] || undefined : undefined,
        usageCount: 0,
      });
      await this.repo.save(entity.data());
      imported++;
    }

    return { totalRows: dataLines.length, imported, errors };
  }
}
