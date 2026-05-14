import * as Sentry from '@sentry/react-native';
import { SentryErrorReportingAdapter } from '../../../src/infrastructure/analytics/SentryErrorReportingAdapter';
import { ErrorReportingAdapter } from '../../../src/infrastructure/analytics/ErrorReportingAdapter';

describe('SentryErrorReportingAdapter', () => {
  let adapter: SentryErrorReportingAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new SentryErrorReportingAdapter();
  });

  it('is an instance of ErrorReportingAdapter', () => {
    expect(adapter).toBeInstanceOf(ErrorReportingAdapter);
  });

  it('forwards captureException to Sentry.captureException', () => {
    const error = new Error('render crash');
    adapter.captureException(error);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('forwards captureMessage with level to Sentry.captureMessage', () => {
    adapter.captureMessage('DB timeout', 'warning');
    expect(Sentry.captureMessage).toHaveBeenCalledWith('DB timeout', 'warning');
  });

  it('defaults captureMessage level to "error" when not specified', () => {
    adapter.captureMessage('Unhandled rejection');
    expect(Sentry.captureMessage).toHaveBeenCalledWith('Unhandled rejection', 'error');
  });

  it('forwards setUser with id object to Sentry.setUser', () => {
    adapter.setUser('anon-uuid');
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'anon-uuid' });
  });

  it('calls Sentry.setUser(null) on clearUser()', () => {
    adapter.clearUser();
    expect(Sentry.setUser).toHaveBeenCalledWith(null);
  });
});
