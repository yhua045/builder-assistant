import { Mixpanel } from 'mixpanel-react-native';
import { MixpanelAnalyticsAdapter } from '../../../src/shared/infrastructure/analytics/MixpanelAnalyticsAdapter';
import { AnalyticsAdapter } from '../../../src/shared/infrastructure/analytics/AnalyticsAdapter';

describe('MixpanelAnalyticsAdapter', () => {
  let adapter: MixpanelAnalyticsAdapter;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new MixpanelAnalyticsAdapter('test-token');
    // The constructor called `new Mixpanel(...)` — capture the returned mock instance
    mockClient = (Mixpanel as jest.Mock).mock.results[0].value;
  });

  it('is an instance of AnalyticsAdapter', () => {
    expect(adapter).toBeInstanceOf(AnalyticsAdapter);
  });

  it('calls init() on construction (fire-and-forget)', () => {
    expect(mockClient.init).toHaveBeenCalledTimes(1);
  });

  it('calls Mixpanel constructor with the token', () => {
    expect(Mixpanel).toHaveBeenCalledWith('test-token', true);
  });

  it('does not initialize Mixpanel when the token is blank', () => {
    jest.clearAllMocks();

    const blankAdapter = new MixpanelAnalyticsAdapter('   ');

    expect(blankAdapter).toBeInstanceOf(AnalyticsAdapter);
    expect(Mixpanel).not.toHaveBeenCalled();
    expect(() => blankAdapter.track('invoice_created')).not.toThrow();
  });

  it('calls client.track with event and properties on track()', () => {
    adapter.track('invoice_created', { projectId: 'proj-2' });
    expect(mockClient.track).toHaveBeenCalledWith('invoice_created', { projectId: 'proj-2' });
  });

  it('calls client.track with screen_view event on screen()', () => {
    adapter.screen('Quotations');
    expect(mockClient.track).toHaveBeenCalledWith('screen_view', { screen_name: 'Quotations' });
  });

  it('merges extra properties into the screen_view event', () => {
    adapter.screen('Tasks', { tab: 'active' });
    expect(mockClient.track).toHaveBeenCalledWith('screen_view', {
      screen_name: 'Tasks',
      tab: 'active',
    });
  });

  it('calls client.identify on identify()', () => {
    adapter.identify('anon-uuid');
    expect(mockClient.identify).toHaveBeenCalledWith('anon-uuid');
  });

  it('calls client.reset on reset()', () => {
    adapter.reset();
    expect(mockClient.reset).toHaveBeenCalled();
  });
});
