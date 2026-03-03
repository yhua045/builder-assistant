export interface DelayReasonType {
  id: string;          // e.g. 'WEATHER'
  label: string;       // e.g. 'Bad weather'
  displayOrder: number;
  isActive: boolean;
}

export interface DelayReason {
  id: string;
  taskId: string;
  reasonTypeId: string;        // FK to DelayReasonType.id
  reasonTypeLabel?: string;    // denormalised label for display (populated by repo)
  notes?: string;              // optional supplemental free text (reasonDetails)
  delayDurationDays?: number;  // estimatedDelayDays
  delayDate?: string;          // reportedAt — ISO date string
  actor?: string;              // reportedBy
  resolvedAt?: string;         // ISO date string — set when the delay is lifted
  mitigationNotes?: string;    // optional resolution / workaround notes
  createdAt: string;
}
