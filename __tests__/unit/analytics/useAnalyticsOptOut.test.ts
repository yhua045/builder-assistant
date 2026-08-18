import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act } from '@testing-library/react-native';
import { useAnalyticsOptOut } from '../../../src/shared/ui/hooks/useAnalyticsOptOut';

describe('useAnalyticsOptOut', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('initialises with isOptedOut = false when no stored value', async () => {
    const { result } = renderHook(() => useAnalyticsOptOut());

    // Wait for the effect to read AsyncStorage
    await act(async () => {});

    expect(result.current.isOptedOut).toBe(false);
  });

  it('initialises with isOptedOut = true when stored value is "true"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');

    const { result } = renderHook(() => useAnalyticsOptOut());
    await act(async () => {});

    expect(result.current.isOptedOut).toBe(true);
  });

  it('initialises with isOptedOut = false when stored value is "false"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('false');

    const { result } = renderHook(() => useAnalyticsOptOut());
    await act(async () => {});

    expect(result.current.isOptedOut).toBe(false);
  });

  it('reads the key "analytics_opt_out" from AsyncStorage', async () => {
    renderHook(() => useAnalyticsOptOut());
    await act(async () => {});

    expect(AsyncStorage.getItem).toHaveBeenCalledWith('analytics_opt_out');
  });

  it('setOptOut(true) writes "true" to AsyncStorage and updates state', async () => {
    const { result } = renderHook(() => useAnalyticsOptOut());
    await act(async () => {});

    await act(async () => {
      await result.current.setOptOut(true);
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('analytics_opt_out', 'true');
    expect(result.current.isOptedOut).toBe(true);
  });

  it('setOptOut(false) writes "false" to AsyncStorage and updates state', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');

    const { result } = renderHook(() => useAnalyticsOptOut());
    await act(async () => {});

    await act(async () => {
      await result.current.setOptOut(false);
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('analytics_opt_out', 'false');
    expect(result.current.isOptedOut).toBe(false);
  });
});
