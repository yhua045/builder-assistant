import { ILookupProvider, LookupResult } from '../../../domain/services/ILookupProvider';

export class LookupUnavailableError extends Error {
  constructor(reason = 'Lookup provider is not available') {
    super(reason);
    this.name = 'LookupUnavailableError';
  }
}

export interface LookupSearchInput {
  query: string;
  /** Milliseconds before the search is aborted. Defaults to 10 000 ms. */
  timeoutMs?: number;
}

export class LookupProviderSearchUseCase {
  constructor(private readonly provider: ILookupProvider) {}

  async execute(input: LookupSearchInput): Promise<LookupResult[]> {
    if (!this.provider.isAvailable()) {
      throw new LookupUnavailableError();
    }

    const timeoutMs = input.timeoutMs ?? 10_000;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new LookupUnavailableError('Lookup timed out')), timeoutMs),
    );

    return Promise.race([this.provider.search(input.query), timeoutPromise]);
  }
}
