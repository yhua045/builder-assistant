/**
 * Domain Service: ProjectValidationService
 * 
 * Contains domain logic for project validation that doesn't belong
 * to a specific entity but is part of the business rules.
 */

import { Project, ProjectPhase, Material, ProjectStatus } from '../entities/Project';
import { ProjectWorkflowService, WorkflowCheck } from './ProjectWorkflowService';

export class ProjectValidationService {
  private workflowService: ProjectWorkflowService;

  constructor(workflowService?: ProjectWorkflowService) {
    this.workflowService = workflowService ?? new ProjectWorkflowService();
  }

  /**
   * Validates if a status transition is allowed by workflow rules
   * @param currentStatus - The current project status
   * @param newStatus - The desired new project status
   * @returns WorkflowCheck result indicating if transition is valid
   */
  validateStatusTransition(currentStatus: ProjectStatus, newStatus: ProjectStatus): WorkflowCheck {
    return this.workflowService.canTransition(currentStatus, newStatus);
  }

  /**
   * Gets the list of allowed next statuses from current status
   * @param currentStatus - The current project status
   * @returns Array of allowed next statuses
   */
  getAllowedNextStatuses(currentStatus: ProjectStatus): ProjectStatus[] {
    return this.workflowService.allowedNext(currentStatus);
  }

  /**
   * Validates if a project phase can be started based on dependencies
   */
  static canStartPhase(phase: ProjectPhase, completedPhases: ProjectPhase[]): boolean {
    const completedPhaseIds = new Set(completedPhases.map(p => p.id));

    return (phase.dependencies ?? []).every(depId => completedPhaseIds.has(depId));
  }

  /**
   * Validates if all required materials are available for a phase
   */
  static areMaterialsAvailable(phase: ProjectPhase, availableMaterials: Material[]): boolean {
    const availableMaterialIds = new Set(availableMaterials.map(m => m.id));

    return (phase.materialsRequired ?? []).every(materialId =>
      availableMaterialIds.has(materialId)
    );
  }

  /**
   * Checks for potential design flaws in project timeline
   */
  static validateProjectTimeline(project: Project): string[] {
    const issues: string[] = [];
    
    // Check for overlapping phases that shouldn't overlap
    const phases = project.phases
      .filter(p => p.startDate && p.endDate)
      .sort((a, b) => (a.startDate!.getTime() - b.startDate!.getTime()));

    for (let i = 0; i < phases.length - 1; i++) {
      const currentPhase = phases[i];
      const nextPhase = phases[i + 1];

      if (nextPhase.startDate! < currentPhase.endDate! &&
          !(nextPhase.dependencies ?? []).includes(currentPhase.id)) {
        issues.push(`Phase "${nextPhase.name}" overlaps with "${currentPhase.name}" without proper dependency`);
      }
    }

    // Check for unrealistic phase durations
    phases.forEach(phase => {
      if (!phase.startDate || !phase.endDate) return;
      const duration = phase.endDate.getTime() - phase.startDate.getTime();
      const daysDuration = duration / (1000 * 60 * 60 * 24);

      if (daysDuration < 1) {
        issues.push(`Phase "${phase.name}" has unrealistically short duration (less than 1 day)`);
      }

      if (daysDuration > 365) {
        issues.push(`Phase "${phase.name}" has very long duration (over 1 year) - consider breaking into sub-phases`);
      }
    });
    
    return issues;
  }

  /**
   * Estimates material waste and suggests optimizations
   */
  static analyzeResourceEfficiency(materials: Material[]): {
    wasteEstimate: number;
    suggestions: string[];
  } {
    const suggestions: string[] = [];
    let totalWasteEstimate = 0;
    
    materials.forEach(material => {
      const totalCost = material.quantity * material.unitCost;
      
      // Typical waste percentages by material type (simplified example)
      let wastePercentage = 0.05; // Default 5%
      
      if (material.name.toLowerCase().includes('concrete')) {
        wastePercentage = 0.03; // 3% for concrete
      } else if (material.name.toLowerCase().includes('lumber') || 
                 material.name.toLowerCase().includes('wood')) {
        wastePercentage = 0.10; // 10% for lumber
        suggestions.push(`Consider pre-cutting lumber to reduce waste for ${material.name}`);
      } else if (material.name.toLowerCase().includes('tile') || 
                 material.name.toLowerCase().includes('ceramic')) {
        wastePercentage = 0.15; // 15% for tiles
        suggestions.push(`Order extra tiles for ${material.name} to account for breakage and cuts`);
      }
      
      totalWasteEstimate += totalCost * wastePercentage;
    });
    
    if (totalWasteEstimate > 5000) {
      suggestions.push('High material waste estimated - consider bulk purchasing and storage strategies');
    }
    
    return {
      wasteEstimate: totalWasteEstimate,
      suggestions
    };
  }
}