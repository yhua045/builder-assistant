import React from 'react';
import { View, Text } from 'react-native';
import { AlertCircle } from 'lucide-react-native';

export type UrgentAlert = {
  id: string;
  type: string;
  title: string;
  vendor: string;
  amount: number;
  daysOverdue?: number;
  expiredDays?: number;
  project?: string;
};

export default function UrgentAlerts({ alerts }: { alerts: UrgentAlert[] }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <View className="px-6 mb-6">
      <View className="flex-row items-center mb-3">
        <AlertCircle className="text-destructive mr-2" size={20} />
        <Text className="text-lg font-bold text-foreground">Urgent Alerts</Text>
      </View>

      <View className="gap-3">
        {alerts.map((alert) => (
          <View key={alert.id} className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
            <View className="flex-row items-start justify-between mb-2">
              <View className="flex-1">
                <Text className="text-destructive font-bold text-base mb-1">{alert.title}</Text>
                <Text className="text-foreground font-medium">{alert.vendor}</Text>
                <Text className="text-muted-foreground text-sm">{alert.project}</Text>
              </View>
              <Text className="text-destructive font-bold text-xl">${alert.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View className="bg-destructive/20 px-3 py-1.5 rounded-lg self-start">
              <Text className="text-destructive text-xs font-semibold">
                {alert.type === 'overdue_payment' ? `${alert.daysOverdue} days overdue` : `Expired ${alert.expiredDays} days ago`}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
