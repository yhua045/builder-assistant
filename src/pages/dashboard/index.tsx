import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '../../components/ThemeToggle';
import HeroSection from './components/HeroSection';
import CashOutflow from './components/CashOutflow';
import ActiveTasks from './components/ActiveTasks';
import UrgentAlerts from './components/UrgentAlerts';
import { SnapReceiptScreen } from '../receipts/SnapReceiptScreen';
import { InvoiceScreen } from '../invoices/InvoiceScreen';
import { QuotationScreen } from '../quotations/QuotationScreen';
import { 
  DollarSign, 
  Plus,
  Camera,
  FileText,
  Wrench,
  Receipt,
  X
} from 'lucide-react-native';

// Mock data
const hasProjects = false; // Change to true to hide hero section
const urgentAlerts = [
  {
    id: '1',
    type: 'overdue_payment',
    title: 'Overdue Payment',
    vendor: 'ABC Construction Co.',
    amount: 8500.00,
    daysOverdue: 3,
    project: 'Office Renovation'
  },
  {
    id: '2',
    type: 'expired_quote',
    title: 'Quote Expired',
    vendor: 'Elite Electrical Services',
    amount: 3200.00,
    expiredDays: 2,
    project: 'Warehouse Expansion'
  }
];

const paymentsThisWeek = [
  {
    id: '1',
    vendor: 'Premium Plumbing Inc.',
    amount: 4200.00,
    dueDate: 'Dec 26',
    project: 'Office Renovation',
    invoice: 'INV-2024-089'
  },
  {
    id: '2',
    vendor: 'City Landscaping Co.',
    amount: 2850.00,
    dueDate: 'Dec 27',
    project: 'Retail Store Setup',
    invoice: 'INV-2024-091'
  },
  {
    id: '3',
    vendor: 'SafeGuard Security Systems',
    amount: 5100.00,
    dueDate: 'Dec 28',
    project: 'Warehouse Expansion',
    invoice: 'INV-2024-093'
  }
];

const nextUpTasks = [
  {
    id: '1',
    title: 'Pool Cleaner Visit',
    time: 'Today, 2:00 PM',
    vendor: 'AquaClear Pool Services',
    project: 'Office Renovation',
    type: 'Maintenance'
  },
  {
    id: '2',
    title: 'Electrical Inspection',
    time: 'Today, 4:30 PM',
    vendor: 'Elite Electrical Services',
    project: 'Warehouse Expansion',
    type: 'Inspection'
  },
  {
    id: '3',
    title: 'Plumbing Repair',
    time: 'Tomorrow, 10:00 AM',
    vendor: 'Premium Plumbing Inc.',
    project: 'Office Renovation',
    type: 'Repair'
  },
  {
    id: '4',
    title: 'HVAC Maintenance',
    time: 'Tomorrow, 2:00 PM',
    vendor: 'CoolAir HVAC Solutions',
    project: 'Retail Store Setup',
    type: 'Maintenance'
  }
];

const quickActions = [
  { id: '1', title: 'Snap Receipt', icon: Camera, color: 'bg-chart-1' },
  { id: '2', title: 'Add Invoice', icon: Receipt, color: 'bg-chart-5' },
  { id: '3', title: 'Log Payment', icon: DollarSign, color: 'bg-chart-2' },
  { id: '4', title: 'Add Quote', icon: FileText, color: 'bg-chart-3' },
  { id: '5', title: 'Ad Hoc Task', icon: Wrench, color: 'bg-chart-4' }
];

export default function DashboardScreen() {
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showSnapReceipt, setShowSnapReceipt] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  
  const [showQuotation, setShowQuotation] = useState(false);

  const handleQuickAction = (actionId: string) => {
    setShowQuickActions(false);
    if (actionId === '1') { // Snap Receipt
      setShowSnapReceipt(true);
    } else if (actionId === '2') { // Add Invoice
      setShowAddInvoice(true);
    } else if (actionId === '3') { // Add Quote
      setShowQuotation(true);
    }
    // Handle other actions...
  };

  // Invoice creation is handled inside InvoiceScreen; Dashboard only toggles modal visibility.

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center justify-between">
        <View>
          <Text className="text-muted-foreground text-sm">Welcome back,</Text>
          <Text className="text-2xl font-bold text-foreground">Dashboard</Text>
        </View>
        <ThemeToggle />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Hero Section - Show when no projects exist */}
        {!hasProjects && <HeroSection />}
        {hasProjects && (
          <>
            <UrgentAlerts alerts={urgentAlerts} />

            {/* 2. Cash Outflow + Payment List */}
            <CashOutflow payments={paymentsThisWeek} />

            {/* 3. Active Tasks */}
            <ActiveTasks tasks={nextUpTasks} />
          </>
        )}
      </ScrollView>

      {/* 4. Quick Actions - Floating Action Button */}
      <View className="absolute bottom-24 right-6">
        <Pressable
          onPress={() => setShowQuickActions(true)}
          className="bg-primary rounded-full w-16 h-16 items-center justify-center shadow-lg active:opacity-80"
        >
          <Plus className="text-primary-foreground" size={28} />
        </Pressable>
      </View>

      {/* Quick Actions Modal */}
      <Modal
        visible={showQuickActions}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQuickActions(false)}
      >
        <Pressable 
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onPress={() => setShowQuickActions(false)}
        >
          <Pressable 
            style={{ backgroundColor: '#ffffff' }}
            className="rounded-t-3xl p-6 dark:bg-[#1e1e1e]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">Quick Actions</Text>
              <Pressable onPress={() => setShowQuickActions(false)}>
                <X className="text-muted-foreground" size={24} />
              </Pressable>
            </View>

            <View className="gap-3">
              {quickActions.map((action) => {
                const IconComponent = action.icon;
                return (
                  <Pressable
                    key={action.id}
                    onPress={() => handleQuickAction(action.id)}
                    className="bg-card border border-border rounded-xl p-4 flex-row items-center active:opacity-70"
                  >
                    <View className={`${action.color}/10 p-3 rounded-lg mr-4`}>
                      <IconComponent className={action.color.replace('bg-', 'text-')} size={24} />
                    </View>
                    <Text className="text-foreground font-semibold text-base">{action.title}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="h-8" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Snap Receipt Modal */}
      <Modal
        visible={showSnapReceipt}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSnapReceipt(false)}
      >
        <SnapReceiptScreen onClose={() => setShowSnapReceipt(false)} enableOcr={true} />
      </Modal>

      {/* Add Invoice Modal */}
      <Modal
        visible={showAddInvoice}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddInvoice(false)}
        testID="add-invoice-modal"
      >
        <InvoiceScreen onClose={() => setShowAddInvoice(false)} />
      </Modal>
      {/* Quotation Modal */}
      <QuotationScreen
        visible={showQuotation}
        onClose={() => setShowQuotation(false)}
        onSuccess={() => {
          // Optionally refresh quotation list here when that component exists
          console.log('Quotation created successfully');
        }}
      />
    </SafeAreaView>
  );
}