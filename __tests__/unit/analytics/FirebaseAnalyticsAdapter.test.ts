import analytics from '@react-native-firebase/analytics';
import { FirebaseAnalyticsAdapter } from '../../../src/infrastructure/analytics/FirebaseAnalyticsAdapter';
import { AnalyticsAdapter } from '../../../src/infrastructure/analytics/AnalyticsAdapter';

// Get the stable mock instance that the mock factory always returns
const mockInstance = (analytics as jest.Mock)();

describe('FirebaseAnalyticsAdapter', () => {
  let adapter: FirebaseAnalyticsAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new FirebaseAnalyticsAdapter();
  });

  it('is an instance of AnalyticsAdapter', () => {
    expect(adapter).toBeInstanceOf(AnalyticsAdapter);
  });

  it('calls logEvent with event name and properties on track()', () => {
    adapter.track('task_created', { projectId: 'proj-1' });
    expect(mockInstance.logEvent).toHaveBeenCalledWith('task_created', { projectId: 'proj-1' });
  });

  it('calls logEvent with only event name when no properties', () => {
    adapter.track('task_deleted');
    expect(mockInstance.logEvent).toHaveBeenCalledWith('task_deleted', undefined);
  });

  it('calls logScreenView with screen_name and screen_class on screen()', () => {
    adapter.screen('Dashboard');
    expect(mockInstance.logScreenView).toHaveBeenCalledWith({
      screen_name: 'Dashboard',
      screen_class: 'Dashboard',
    });
  });

  it('calls setUserId on identify()', () => {
    adapter.identify('anon-uuid');
    expect(mockInstance.setUserId).toHaveBeenCalledWith('anon-uuid');
  });

  it('calls resetAnalyticsData on reset()', () => {
    adapter.reset();
    expect(mockInstance.resetAnalyticsData).toHaveBeenCalled();
  });
});
