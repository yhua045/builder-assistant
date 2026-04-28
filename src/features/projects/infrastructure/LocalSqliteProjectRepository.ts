import { DrizzleProjectRepository } from './DrizzleProjectRepository';

/**
 * LocalSqliteProjectRepository is a thin alias around DrizzleProjectRepository.
 * Tests import this symbol historically; re-exporting preserves compatibility.
 */
export class LocalSqliteProjectRepository extends DrizzleProjectRepository {}

export default LocalSqliteProjectRepository;
