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
  notes?: string;              // optional supplemental free text
  delayDurationDays?: number;
  delayDate?: string;          // ISO date string
  actor?: string;
  createdAt: string;
}
