/**
 * ProjectCard Component
 * 
 * Displays a project summary in a card format
 */

import React from 'react';
import {
  View,
  Text,
  ViewStyle,
  Pressable
} from 'react-native';
import { ProjectStatus } from '../domain/entities/Project';
import { ProjectCardDto } from '../application/dtos/ProjectCardDto';
import { 
  MapPin,  
  Phone, 
  CheckCircle, 
  Clock,
  ChevronRight,
} from 'lucide-react-native';

interface ProjectCardProps {
  project: ProjectCardDto;
  onPress?: (project: ProjectCardDto) => void;
  style?: ViewStyle;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onPress,
  style
}) => {
  return (
    <Pressable 
      onPress={() => onPress?.(project)}
      className="bg-card border border-border rounded-2xl p-5 active:opacity-80"
      style={style}
    >
      {/* Project Header */}
      <View className="flex-row items-start justify-between mb-4">
        <View className="flex-1 mr-3">
          <Text className="text-lg font-bold text-foreground mb-1">
            {project.owner}
          </Text>
          <View className="flex-row items-center">
            <MapPin className="text-muted-foreground mr-1.5" size={14} />
            <Text className="text-muted-foreground text-sm flex-1" numberOfLines={1}>
              {project.address}
            </Text>
          </View>
        </View>
        <View 
          className={`px-2.5 py-1 rounded-full ${
            project.status === ProjectStatus.IN_PROGRESS 
              ? 'bg-chart-2/10' 
              : 'bg-chart-4/10'
          }`}
        >
          <Text 
            className={`text-xs font-semibold ${
              project.status === ProjectStatus.IN_PROGRESS 
                ? 'text-chart-2' 
                : 'text-chart-4'
            }`}
          >
            {project.status === ProjectStatus.IN_PROGRESS ? 'Active' : 'On Hold'}
          </Text>
        </View>
      </View>

      {/* Contact Info */}
      <View className="flex-row items-center mb-4">
        <Phone className="text-muted-foreground mr-2" size={16} />
        <Text className="text-muted-foreground text-sm">{project.contact}</Text>
      </View>

      {/* Last Completed Task */}
      <View className="bg-muted/50 rounded-xl p-3 mb-3">
        <View className="flex-row items-center mb-1.5">
          <CheckCircle className="text-chart-2 mr-2" size={16} />
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Last Completed
          </Text>
        </View>
        <Text className="text-foreground font-semibold text-sm mb-1">
          {project.lastCompletedTask.title}
        </Text>
        <Text className="text-muted-foreground text-xs">
          {project.lastCompletedTask.completedDate}
        </Text>
      </View>

      {/* Upcoming Tasks */}
      <View className="bg-primary/5 rounded-xl p-3">
        <View className="flex-row items-center mb-2">
          <Clock className="text-primary mr-2" size={16} />
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Upcoming Tasks ({project.upcomingTasks.length})
          </Text>
        </View>
        <View className="gap-2">
          {project.upcomingTasks.map((task, index) => (
            <View key={index} className="flex-row items-center justify-between">
              <Text className="text-foreground font-medium text-sm">
                {task.title}
              </Text>
              <Text className="text-primary text-xs font-semibold">
                {task.dueDate}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Chevron Indicator */}
      <View className="flex-row justify-end mt-4">
        <ChevronRight className="text-muted-foreground" size={20} />
      </View>
    </Pressable>
  );
};