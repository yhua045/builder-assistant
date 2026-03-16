import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PaymentsScreen from './index';
import PaymentDetails from './PaymentDetails';
import { Payment } from '../../domain/entities/Payment';

export type PaymentsStackParamList = {
  PaymentsList: undefined;
  PaymentDetails: { paymentId?: string; syntheticRow?: Payment };
};

const Stack = createNativeStackNavigator();

export default function PaymentsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PaymentsList" component={PaymentsScreen} />
      <Stack.Screen
        name="PaymentDetails"
        component={PaymentDetails}
        options={{ presentation: 'card' }}
      />
    </Stack.Navigator>
  );
}
