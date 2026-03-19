import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useProjectsOverview } from '../../hooks/useProjectsOverview';
import { ProjectOverviewCard } from './components/ProjectOverviewCard';
import HeroSection from './components/HeroSection';
import { LayoutGrid, List, Camera, Receipt, DollarSign, FileText, Wrench, X, Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { SnapReceiptScreen } from '../receipts/SnapReceiptScreen';
import { InvoiceScreen } from '../invoices/InvoiceScreen';
import { QuotationScreen } from '../quotations/QuotationScreen';
import { MobileOcrAdapter } from '../../infrastructure/ocr/MobileOcrAdapter';
import { InvoiceNormalizer } from '../../application/ai/InvoiceNormalizer';
import { PdfThumbnailConverter } from '../../infrastructure/files/PdfThumbnailConverter';

type DashboardNavigationProp = any;

const quickActions = [
  { id: '1', title: 'Snap Receipt', icon: Camera, color: 'bg-chart-1' },
  { id: '2', title: 'Add Invoice', icon: Receipt, color: 'bg-chart-5' },
  { id: '3', title: 'Log Payment', icon: DollarSign, color: 'bg-chart-2' },
  { id: '4', title: 'Add Quote', icon: FileText, color: 'bg-chart-3' },
  { id: '5', title: 'Ad Hoc Task', icon: Wrench, color: 'bg-chart-4' }
];

export default function DashboardScreen() {
  const { data: overviews, isLoading, error } = useProjectsOverview();
  const [isComprehensive, setIsComprehensive] = useState(false);
  const navigation = useNavigation<DashboardNavigationProp>();

  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showSnapReceipt, setShowSnapReceipt] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [showAdHocTask, setShowAdHocTask] = useState(false);
  const [showQuotation, setShowQuotation] = useState(false);

  const invoiceOcrAdapter = useMemo(() => new MobileOcrAdapter(), []);
  const invoiceNormalizer = useMemo(() => new InvoiceNormalizer(), []);
  const invoicePdfConverter = useMemo(() => new PdfThumbnailConverter(), []);

  const handleQuickAction = (actionId: string) => {
    setShowQuickActions(false);
    if (actionId === '1') {
      setShowSnapReceipt(true);
    } else if (actionId === '2') {
      setShowAddInvoice(true);
    } else if (actionId === '3') {
      // TODO: Log Payment
    } else if (actionId === '4') {
      setShowQuotation(true);
    } else if (actionId === '5') {
      setShowAdHocTask(true);
    }
  };

  const hasProjects = (overviews?.length ?? 0) > 0;

  const navigateToProject = (projectId: string) => {
    // Dispatch the full stack state so ProjectsList is always the base screen.
    // A plain navigate('Projects', { screen: 'ProjectDetail' }) only targets the
    // leaf screen and can leave the stack as [ProjectDetail] with no base,
    // causing the back button to jump to the Dashboard tab instead of ProjectsList.
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Projects',
        params: {
          screen: 'ProjectDetail',
          params: { projectId },
          initial: false,
        },
      }),
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Dashboard</Text>
          <Text className="text-muted-foreground text-sm">Overview</Text>
        </View>
        <View className="flex-row items-center">
          {hasProjects && (
            <View className="flex-row bg-secondary/50 rounded-lg p-1 mr-4">
              <Pressable
                onPress={() => setIsComprehensive(false)}
                className={`p-1.5 rounded-md ${!isComprehensive ? 'bg-background shadow-sm' : ''}`}
              >
                <List size={18} className={!isComprehensive ? 'text-primary' : 'text-muted-foreground'} />
              </Pressable>
              <Pressable
                onPress={() => setIsComprehensive(true)}
                className={`p-1.5 rounded-md ${isComprehensive ? 'bg-background shadow-sm' : ''}`}
              >
                <LayoutGrid size={18} className={isComprehensive ? 'text-primary' : 'text-muted-foreground'} />
              </Pressable>
            </View>
          )}
          <ThemeToggle />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        {isLoading && (
          <View className="px-6 mt-4">
            <Text className="text-muted-foreground">Loading projects...</Text>
          </View>
        )}

        {error && (
          <View className="px-6 mt-4 p-4 bg-destructive/10 rounded-xl">
            <Text className="text-destructive">Failed to load overview data</Text>
          </View>
        )}

        {!isLoading && !error && !hasProjects && <HeroSection />}

        {!isLoading && !error && hasProjects && overviews && (
          <View className="px-6 mt-2">
             <Text className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
               Active Projects ({overviews.length})
             </Text>
            {overviews.map(overview => (
              <ProjectOverviewCard
                key={overview.project.id}
                overview={overview}
                isComprehensive={isComprehensive}
                onPress={() => navigateToProject(overview.project.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Quick Actions - Floating Action Button */}
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
          style={styles.modalBackdrop}
          onPress={() => setShowQuickActions(false)}
        >
          <Pressable 
            style={styles.modalContainer}
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
        <InvoiceScreen
          onClose={() => setShowAddInvoice(false)}
          ocrAdapter={invoiceOcrAdapter}
          invoiceNormalizer={invoiceNormalizer}
          pdfConverter={invoicePdfConverter}
        />
      </Modal>

      {/* Ad Hoc Task (TaskScreen manages its own Modal) */}
      {showAdHocTask && (
        (() => {
          const TaskScreen = require('../tasks/TaskScreen').default;
          return <TaskScreen onClose={() => setShowAdHocTask(false)} />;
        })()
      )}

      {/* Quotation Modal */}
      <QuotationScreen
        visible={showQuotation}
        onClose={() => setShowQuotation(false)}
        onSuccess={() => {}}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContainer: { backgroundColor: '#ffffff' },
});