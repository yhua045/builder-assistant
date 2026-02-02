/**
 * Domain Entity: Project
 * 
 * Represents a building project in the domain layer.
 * This entity contains the core business logic and rules.
 */

export interface Project {
  id: string;
  propertyId?: string;
  ownerId?: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate?: Date; // Date object
  expectedEndDate?: Date; // Date object
  budget?: number;
  currency?: string;
  materials: Material[];
  phases: ProjectPhase[];
  meta?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}


export enum ProjectStatus {
  PLANNING = 'planning',
  IN_PROGRESS = 'in_progress',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface Material {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  supplier?: string; // contact id or name
  estimatedDeliveryDate?: Date; // Date
  projectId?: string; // parent project id (foreign key)
}

export interface ProjectPhase {
  id: string;
  name: string;
  description?: string;
  startDate?: Date; // Date
  endDate?: Date; // Date
  dependencies?: string[]; // IDs of phases that must complete first
  isCompleted?: boolean;
  materialsRequired?: string[]; // Material IDs
  projectId?: string; // parent project id (foreign key)
}

function toDate(v?: string | Date): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Domain rules and validation logic
 */
export class ProjectEntity {
  private constructor(private readonly project: Project) {}

  static create(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): ProjectEntity {
    const id = projectData.id ?? this.generateId();
    const now = new Date();

    const mappedMaterials = (projectData.materials ?? []).map(m => ({
      ...m,
      projectId: m.projectId ?? id,
      estimatedDeliveryDate: m.estimatedDeliveryDate ? toDate(m.estimatedDeliveryDate) : undefined
    }));

    const mappedPhases = (projectData.phases ?? []).map(p => ({
      ...p,
      projectId: p.projectId ?? id,
      startDate: p.startDate ? toDate(p.startDate) : undefined,
      endDate: p.endDate ? toDate(p.endDate) : undefined
    }));

    const project: Project = {
      id,
      createdAt: now,
      updatedAt: now,
      ...projectData,
      startDate: projectData.startDate ? toDate(projectData.startDate) : undefined,
      expectedEndDate: projectData.expectedEndDate ? toDate(projectData.expectedEndDate) : undefined,
      materials: mappedMaterials,
      phases: mappedPhases
    } as Project;

    this.validateProject(project);
    return new ProjectEntity(project);
  }

  static fromData(project: Project): ProjectEntity {
    const normalizedMaterials = (project.materials ?? []).map(m => ({
      ...m,
      projectId: m.projectId ?? project.id,
      estimatedDeliveryDate: m.estimatedDeliveryDate ? toDate(m.estimatedDeliveryDate) : undefined
    }));

    const normalizedPhases = (project.phases ?? []).map(p => ({
      ...p,
      projectId: p.projectId ?? project.id,
      startDate: p.startDate ? toDate(p.startDate) : undefined,
      endDate: p.endDate ? toDate(p.endDate) : undefined
    }));

    const normalized: Project = {
      ...project,
      startDate: project.startDate ? toDate(project.startDate) : undefined,
      expectedEndDate: project.expectedEndDate ? toDate(project.expectedEndDate) : undefined,
      createdAt: project.createdAt ? toDate(project.createdAt) : undefined,
      updatedAt: project.updatedAt ? toDate(project.updatedAt) : undefined,
      materials: normalizedMaterials,
      phases: normalizedPhases
    };

    this.validateProject(normalized);
    return new ProjectEntity(normalized);
  }

  private static validateProject(project: Project): void {
    if (!project.name || project.name.trim().length === 0) {
      throw new Error('Project name is required');
    }

    if (project.budget !== undefined && project.budget < 0) {
      throw new Error('Project budget cannot be negative');
    }

    if (project.startDate && project.expectedEndDate) {
      if (!(project.startDate instanceof Date) || isNaN(project.startDate.getTime()) ||
          !(project.expectedEndDate instanceof Date) || isNaN(project.expectedEndDate.getTime())) {
        throw new Error('Invalid date for startDate or expectedEndDate');
      }
      if (project.startDate.getTime() >= project.expectedEndDate.getTime()) {
        throw new Error('Expected end date must be after start date');
      }
    }

    // Ensure phases/materials reference the same parent project id when present
    (project.phases || []).forEach(phase => {
      if (phase.projectId && phase.projectId !== project.id) {
        throw new Error('Phase projectId must match parent project id');
      }
    });

    (project.materials || []).forEach(material => {
      if (material.projectId && material.projectId !== project.id) {
        throw new Error('Material projectId must match parent project id');
      }
    });
  }

  private static generateId(): string {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  get data(): Project {
    return { ...this.project };
  }

  updateStatus(newStatus: ProjectStatus): ProjectEntity {
    const updatedProject = {
      ...this.project,
      status: newStatus,
      updatedAt: new Date()
    };
    return new ProjectEntity(updatedProject);
  }

  addMaterial(material: Material): ProjectEntity {
    const updatedProject = {
      ...this.project,
      materials: [...(this.project.materials || []), { ...material, projectId: material.projectId ?? this.project.id }],
      updatedAt: new Date()
    };
    return new ProjectEntity(updatedProject);
  }

  getTotalMaterialCost(): number {
    return (this.project.materials || []).reduce(
      (total, material) => total + (material.quantity * material.unitCost),
      0
    );
  }

  isOverBudget(): boolean {
    if (this.project.budget === undefined) return false;
    return this.getTotalMaterialCost() > (this.project.budget ?? 0);
  }

  getCompletedPhases(): ProjectPhase[] {
    return (this.project.phases || []).filter(phase => phase.isCompleted);
  }

  getProgressPercentage(): number {
    const phases = this.project.phases || [];
    if (phases.length === 0) return 0;
    const completedPhases = this.getCompletedPhases().length;
    return (completedPhases / phases.length) * 100;
  }
}