import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ErrorReportingAdapter } from '../../shared/infrastructure/analytics/ErrorReportingAdapter';

interface Props {
  children: React.ReactNode;
  errorReportingAdapter?: ErrorReportingAdapter;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global React error boundary.
 *
 * Catches render-phase exceptions and reports them via ErrorReportingAdapter.
 * Wrap the root <NavigationContainer> in App.tsx with this component.
 *
 * Usage:
 *   <ErrorBoundary errorReportingAdapter={sentryAdapter}>
 *     <NavigationContainer>...</NavigationContainer>
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: React.ErrorInfo): void {
    const { errorReportingAdapter } = this.props;
    if (errorReportingAdapter) {
      errorReportingAdapter.captureException(error);
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.text}>Something went wrong.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
  },
});
