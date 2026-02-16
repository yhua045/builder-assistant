import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '../../components/ThemeToggle';
import { cssInterop } from 'nativewind';
import { User, Mail, Phone, Briefcase, Building2, MapPin, 
  Settings, Bell, Lock, CreditCard, HelpCircle, 
  LogOut, ChevronRight, Edit 
} from 'lucide-react-native';

cssInterop(User, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Mail, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Phone, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Briefcase, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Building2, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(MapPin, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Settings, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Bell, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Lock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CreditCard, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(HelpCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(LogOut, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ChevronRight, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Edit, { className: { target: 'style', nativeStyleToProp: { color: true } } });

type MenuItemProps = {
  icon: any;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
};

function MenuItem({ icon: Icon, label, value, onPress, showChevron = true }: MenuItemProps) {
  return (
    <TouchableOpacity 
      onPress={onPress}
      className="bg-card rounded-xl p-4 flex-row items-center justify-between mb-3"
    >
      <View className="flex-row items-center flex-1">
        <View className="bg-primary/10 p-2 rounded-lg mr-3">
          <Icon className="text-primary" size={20} />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-medium">{label}</Text>
          {value && (
            <Text className="text-muted-foreground text-sm mt-0.5">{value}</Text>
          )}
        </View>
      </View>
      {showChevron && (
        <ChevronRight className="text-muted-foreground" size={20} />
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const user = {
    name: 'Sarah Mitchell',
    email: 'sarah.mitchell@constructco.com',
    phone: '+1 (555) 123-4567',
    role: 'Project Manager',
    company: 'ConstructCo Inc.',
    location: 'San Francisco, CA',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8YXZhdGFyfGVufDB8fDB8fHww',
    stats: {
      activeProjects: 3,
      totalExpenses: '$127,450',
      pendingPayments: 4,
    }
  };


  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-6 py-4">
        <Text className="text-2xl font-bold text-foreground">Profile</Text>
        <ThemeToggle />
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Profile Card */}
        <View className="bg-card rounded-2xl p-6 mb-6">
          <View className="items-center">
            {/* Avatar with Edit Button */}
            <View className="relative mb-4">
              <Image 
                source={{ uri: user.avatar }}
                className="w-24 h-24 rounded-full"
              />
              <TouchableOpacity 
                className="absolute bottom-0 right-0 bg-primary p-2 rounded-full"
              >
                <Edit className="text-primary-foreground" size={16} />
              </TouchableOpacity>
            </View>

            {/* User Info */}
            <Text className="text-2xl font-bold text-foreground">{user.name}</Text>
            <Text className="text-muted-foreground mt-1">{user.role}</Text>
            <Text className="text-muted-foreground text-sm">{user.company}</Text>

            {/* Stats Row */}
            <View className="flex-row gap-4 mt-6 w-full">
              <View className="flex-1 bg-background rounded-xl p-3 items-center">
                <Text className="text-2xl font-bold text-primary">{user.stats.activeProjects}</Text>
                <Text className="text-xs text-muted-foreground mt-1">Active Projects</Text>
              </View>
              <View className="flex-1 bg-background rounded-xl p-3 items-center">
                <Text className="text-2xl font-bold text-primary">{user.stats.totalExpenses}</Text>
                <Text className="text-xs text-muted-foreground mt-1">Total Expenses</Text>
              </View>
              <View className="flex-1 bg-background rounded-xl p-3 items-center">
                <Text className="text-2xl font-bold text-primary">{user.stats.pendingPayments}</Text>
                <Text className="text-xs text-muted-foreground mt-1">Pending</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Personal Information */}
        <Text className="text-lg font-semibold text-foreground mb-3">Personal Information</Text>
        <MenuItem icon={Mail} label="Email" value={user.email} />
        <MenuItem icon={Phone} label="Phone" value={user.phone} />
        <MenuItem icon={Briefcase} label="Role" value={user.role} />
        <MenuItem icon={Building2} label="Company" value={user.company} />
        <MenuItem icon={MapPin} label="Location" value={user.location} />

        {/* Account Settings */}
        <Text className="text-lg font-semibold text-foreground mb-3 mt-6">Account Settings</Text>
        <MenuItem icon={Settings} label="General Settings" />
        <MenuItem icon={Bell} label="Notifications" value="Enabled" />
        <MenuItem icon={Lock} label="Privacy & Security" />
        <MenuItem icon={CreditCard} label="Payment Methods" value="2 cards" />

        {/* Support */}
        <Text className="text-lg font-semibold text-foreground mb-3 mt-6">Support</Text>
        <MenuItem icon={HelpCircle} label="Help & Support" />

        {/* Logout */}
        <TouchableOpacity 
          className="bg-destructive/10 rounded-xl p-4 flex-row items-center justify-center mt-4"
        >
          <LogOut className="text-destructive mr-2" size={20} />
          <Text className="text-destructive font-semibold">Logout</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text className="text-center text-muted-foreground text-sm mt-6">
          ExpenseTracker Pro v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 128,
  },
});