import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useConfirm } from '../../src/hooks/useConfirm';

describe('useConfirm', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, _buttons) => {
      // Do nothing by default; individual tests trigger buttons manually
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('calls Alert.alert with title and message', () => {
    const { result } = renderHook(() => useConfirm());
    act(() => {
      result.current.confirm({ title: 'Confirm Delete', message: 'Are you sure?' });
    });
    expect(alertSpy).toHaveBeenCalledWith(
      'Confirm Delete',
      'Are you sure?',
      expect.any(Array),
    );
  });

  it('resolves true when confirm button is pressed', async () => {
    alertSpy.mockImplementation((_title, _msg, buttons: any[]) => {
      // Simulate user pressing the confirm button (last button)
      const confirmBtn = buttons.find((b: any) => b.style !== 'cancel');
      confirmBtn?.onPress?.();
    });

    const { result } = renderHook(() => useConfirm());
    const resolved = await result.current.confirm({ title: 'Delete', message: 'Sure?' });
    expect(resolved).toBe(true);
  });

  it('resolves false when cancel button is pressed', async () => {
    alertSpy.mockImplementation((_title, _msg, buttons: any[]) => {
      const cancelBtn = buttons.find((b: any) => b.style === 'cancel');
      cancelBtn?.onPress?.();
    });

    const { result } = renderHook(() => useConfirm());
    const resolved = await result.current.confirm({ title: 'Delete', message: 'Sure?' });
    expect(resolved).toBe(false);
  });

  it('uses custom confirmLabel and cancelLabel', () => {
    const { result } = renderHook(() => useConfirm());
    act(() => {
      result.current.confirm({
        title: 'Remove',
        message: 'Remove this item?',
        confirmLabel: 'Yes, remove',
        cancelLabel: 'No, keep',
      });
    });
    const buttons: any[] = alertSpy.mock.calls[0][2];
    expect(buttons.find((b: any) => b.text === 'Yes, remove')).toBeDefined();
    expect(buttons.find((b: any) => b.text === 'No, keep')).toBeDefined();
  });

  it('sets destructive style on confirm button when destructive=true', () => {
    const { result } = renderHook(() => useConfirm());
    act(() => {
      result.current.confirm({ title: 'Delete', message: 'Sure?', destructive: true });
    });
    const buttons: any[] = alertSpy.mock.calls[0][2];
    const confirmBtn = buttons.find((b: any) => b.style !== 'cancel');
    expect(confirmBtn?.style).toBe('destructive');
  });

  it('uses default labels when none provided', () => {
    const { result } = renderHook(() => useConfirm());
    act(() => {
      result.current.confirm({ title: 'Test', message: 'Test msg' });
    });
    const buttons: any[] = alertSpy.mock.calls[0][2];
    expect(buttons.find((b: any) => b.text === 'Cancel')).toBeDefined();
    expect(buttons.find((b: any) => b.text === 'Confirm')).toBeDefined();
  });
});
