/**
 * Domain Entity: Project
 * 
 * Represents a building project in the domain layer.
 * This entity contains the core business logic and rules.
 */

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: Date;
  expectedEndDate: Date;
  budget: number;
  materials: Material[];
  phases: ProjectPhase[];
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
  supplier?: string;
  estimatedDeliveryDate?: Date;
}

export interface ProjectPhase {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  dependencies: string[]; // IDs of phases that must complete first
  isCompleted: boolean;
  materialsRequired: string[]; // Material IDs
}

/**
 * Domain rules and validation logic
 */
export class ProjectEntity {
  private constructor(private readonly project: Project) {}

  static create(projectData: Omit<Project, 'id'>): ProjectEntity {
    const id = this.generateId();
    const project: Project = {
      id,
      ...projectData
    };
    
    this.validateProject(project);
    return new ProjectEntity(project);
  }

  static fromData(project: Project): ProjectEntity {
    this.validateProject(project);
    return new ProjectEntity(project);
  }

  private static validateProject(project: Project): void {
    if (!project.name || project.name.trim().length === 0) {
      throw new Error('Project name is required');
    }

    if (project.budget < 0) {
      throw new Error('Project budget cannot be negative');
    }

    if (project.startDate >= project.expectedEndDate) {
      throw new Error('Expected end date must be after start date');
    }
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
      status: newStatus
    };
    return new ProjectEntity(updatedProject);
  }

  addMaterial(material: Material): ProjectEntity {
    const updatedProject = {
      ...this.project,
      materials: [...this.project.materials, material]
    };
    return new ProjectEntity(updatedProject);
  }

  getTotalMaterialCost(): number {
    return this.project.materials.reduce(
      (total, material) => total + (material.quantity * material.unitCost),
      0
    );
  }

  isOverBudget(): boolean {
    return this.getTotalMaterialCost() > this.project.budget;
  }

  getCompletedPhases(): ProjectPhase[] {
    return this.project.phases.filter(phase => phase.isCompleted);
  }

  getProgressPercentage(): number {
    if (this.project.phases.length === 0) return 0;
    const completedPhases = this.getCompletedPhases().length;
    return (completedPhases / this.project.phases.length) * 100;
  }
}