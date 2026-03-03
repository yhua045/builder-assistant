import { useCallback } from 'react';
import { Alert } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/**
 * Reusable confirmation dialog hook.
 * Returns a `confirm` function that shows an Alert and resolves to true (confirmed) or false (cancelled).
 */
export function useConfirm() {
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      Alert.alert(options.title, options.message, [
        {
          text: options.cancelLabel ?? 'Cancel',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: options.confirmLabel ?? 'Confirm',
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ]);
    });
  }, []);

  return { confirm };
}
