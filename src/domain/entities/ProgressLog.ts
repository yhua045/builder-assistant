export interface ProgressLog {
  id: string;
  taskId: string;
  notes?: string;
  logType: 'info' | 'delay' | 'inspection' | 'general' | 'completion' | 'issue' | 'other';
  date?: number;
  actor?: string;
  photos?: string[];
  
  // Delay-specific fields
  reasonTypeId?: string;
  delayDurationDays?: number;
  resolvedAt?: number;
  mitigationNotes?: string;

  createdAt: number;
  updatedAt?: number;
}
