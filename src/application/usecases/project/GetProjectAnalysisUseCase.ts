/**
 * Application Use Case: Get Project Analysis
 * 
 * Provides comprehensive analysis of a project including
 * design flaw detection, material estimation, and timeline validation.
 */

import { ProjectRepository } from '../../domain/repositories/ProjectRepository';
import { ProjectValidationService } from '../../domain/services/ProjectValidationService';
import { ProjectEntity } from '../../domain/entities/Project';

export interface ProjectAnalysisRequest {
  projectId: string;
}

export interface ProjectAnalysisResponse {
  success: boolean;
  analysis?: {
    projectOverview: {
      name: string;
      status: string;
      progressPercentage: number;
      budgetUtilization: number;
      isOverBudget: boolean;
    };
    timelineIssues: string[];
    materialAnalysis: {
      totalMaterialCost: number;
      wasteEstimate: number;
      efficiencySuggestions: string[];
    };
    designFlaws: string[];
    recommendations: string[];
  };
  errors?: string[];
}

export class GetProjectAnalysisUseCase {
  constructor(private readonly projectRepository: ProjectRepository) {}

  async execute(request: ProjectAnalysisRequest): Promise<ProjectAnalysisResponse> {
    try {
      // Find the project
      const project = await this.projectRepository.findById(request.projectId);
      
      if (!project) {
        return {
          success: false,
          errors: ['Project not found']
        };
      }

      const projectEntity = ProjectEntity.fromData(project);
      
      // Analyze timeline issues
      const timelineIssues = ProjectValidationService.validateProjectTimeline(project);
      
      // Analyze material efficiency
      const materialAnalysis = ProjectValidationService.analyzeResourceEfficiency(project.materials);
      
      // Calculate budget utilization
      const totalMaterialCost = projectEntity.getTotalMaterialCost();
      const budgetUtilization = project.budget ? (totalMaterialCost / project.budget) * 100 : 0;
      
      // Generate recommendations based on analysis
      const recommendations: string[] = [];
      
      if (timelineIssues.length > 0) {
        recommendations.push('Review project timeline for potential scheduling conflicts');
      }
      
      if (projectEntity.isOverBudget()) {
        recommendations.push('Project is over budget - consider cost reduction strategies');
      }
      
      if (project.budget !== undefined && materialAnalysis.wasteEstimate > project.budget * 0.1) {
        recommendations.push('Material waste estimate is high - implement waste reduction strategies');
      }
      
      if (project.phases.length === 0) {
        recommendations.push('Add project phases to improve timeline management');
      }
      
      const progressPercentage = projectEntity.getProgressPercentage();
      if (progressPercentage < 10 && project.status === 'in_progress') {
        recommendations.push('Project shows as in progress but has low completion percentage');
      }

      return {
        success: true,
        analysis: {
          projectOverview: {
            name: project.name,
            status: project.status,
            progressPercentage,
            budgetUtilization,
            isOverBudget: projectEntity.isOverBudget()
          },
          timelineIssues,
          materialAnalysis: {
            totalMaterialCost,
            wasteEstimate: materialAnalysis.wasteEstimate,
            efficiencySuggestions: materialAnalysis.suggestions
          },
          designFlaws: timelineIssues, // Timeline issues can be considered design flaws
          recommendations
        }
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }
}