import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PaymentsScreen from './PaymentsScreen';
import PaymentDetails from './PaymentDetails';
import QuotationDetailScreen from '../../../pages/projects/QuotationDetail';
import { Payment } from '../../../domain/entities/Payment';

export type PaymentsStackParamList = {
  PaymentsList: undefined;
  PaymentDetails: {
    paymentId?: string;
    syntheticRow?: Payment;
    /** Navigate here when originating from a TimelineInvoiceCard */
    invoiceId?: string;
    /** When true, action buttons (Make Payment / Make Partial Payment) are hidden */
    readOnly?: boolean;
  };
  QuotationDetail: { quotationId: string };
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
      <Stack.Screen
        name="QuotationDetail"
        component={QuotationDetailScreen}
        options={{ presentation: 'card' }}
      />
    </Stack.Navigator>
  );
}
