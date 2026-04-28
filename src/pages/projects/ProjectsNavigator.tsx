import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProjectsPage from './ProjectsPage';
import ProjectDetailScreen from './ProjectDetail';
import ProjectEditScreen from './ProjectEditScreen';
import QuotationDetailScreen from './QuotationDetail';
import TaskDetailsPage from '../tasks/TaskDetailsPage';
import CreateTaskPage from '../tasks/CreateTaskPage';
import EditTaskPage from '../tasks/EditTaskPage';
import { InvoiceDetailPage } from '../../features/invoices';
import PaymentDetails from '../../features/payments/screens/PaymentDetails';
import { Payment } from '../../domain/entities/Payment';

export type ProjectsStackParamList = {
  ProjectsList: undefined;
  ProjectDetail: { projectId: string };
  ProjectEdit: { projectId: string };
  /** Pushed from within the Projects stack so the user stays in context */
  TaskDetails: { taskId: string; openProgressLog?: boolean; openDocument?: boolean };
  CreateTask: { projectId?: string } | undefined;
  EditTask: { taskId: string };
  /** Pushed when user taps "Open" on a QuotationCard in the Quotes section */
  QuotationDetail: { quotationId: string };
  /** Pushed when user taps View/Mark Paid/Attach on an InvoiceCard in the Payments section */
  InvoiceDetail: { invoiceId: string; openMarkAsPaid?: boolean; openDocument?: boolean };
  /** Pushed from Review Payment on a timeline card — mirrors PaymentsNavigator entry */
  PaymentDetails: {
    paymentId?: string;
    syntheticRow?: Payment;
    invoiceId?: string;
    readOnly?: boolean;
  };
};

const Stack = createNativeStackNavigator();

export default function ProjectsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProjectsList" component={ProjectsPage} />
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="ProjectEdit"
        component={ProjectEditScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="TaskDetails"
        component={TaskDetailsPage}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="CreateTask"
        component={CreateTaskPage}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="EditTask"
        component={EditTaskPage}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="QuotationDetail"
        component={QuotationDetailScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="InvoiceDetail"
        component={InvoiceDetailPage}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="PaymentDetails"
        component={PaymentDetails}
        options={{ presentation: 'card' }}
      />
    </Stack.Navigator>
  );
}
