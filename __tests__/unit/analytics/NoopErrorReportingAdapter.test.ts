import { NoopErrorReportingAdapter } from '../../../src/shared/infrastructure/analytics/NoopErrorReportingAdapter';
import { ErrorReportingAdapter } from '../../../src/shared/infrastructure/analytics/ErrorReportingAdapter';

describe('NoopErrorReportingAdapter', () => {
  let adapter: NoopErrorReportingAdapter;

  beforeEach(() => {
    adapter = new NoopErrorReportingAdapter();
  });

  it('is an instance of ErrorReportingAdapter', () => {
    expect(adapter).toBeInstanceOf(ErrorReportingAdapter);
  });

  it('records captureException() calls without throwing', () => {
    const error = new Error('test error');
    expect(() => adapter.captureException(error)).not.toThrow();
    expect(adapter.getCallsFor('captureException')).toHaveLength(1);
    expect(adapter.getCallsFor('captureException')[0].args[0]).toBe(error);
  });

  it('records captureMessage() calls without throwing', () => {
    expect(() => adapter.captureMessage('Something went wrong', 'error')).not.toThrow();
    expect(adapter.getCallsFor('captureMessage')).toHaveLength(1);
    expect(adapter.getCallsFor('captureMessage')[0].args).toEqual([
      'Something went wrong',
      'error',
    ]);
  });

  it('records setUser() calls without throwing', () => {
    expect(() => adapter.setUser('anon-uuid')).not.toThrow();
    expect(adapter.getCallsFor('setUser')).toHaveLength(1);
  });

  it('records clearUser() calls without throwing', () => {
    expect(() => adapter.clearUser()).not.toThrow();
    expect(adapter.getCallsFor('clearUser')).toHaveLength(1);
  });

  it('clearCalls() empties the call record', () => {
    adapter.captureMessage('msg one');
    adapter.captureMessage('msg two');
    expect(adapter.calls).toHaveLength(2);

    adapter.clearCalls();
    expect(adapter.calls).toHaveLength(0);
  });
});
