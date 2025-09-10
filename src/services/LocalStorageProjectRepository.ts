/**
 * Service: Local Storage Project Repository
 * 
 * Implementation of ProjectRepository using React Native's AsyncStorage.
 * This is part of the infrastructure layer but placed in services for simplicity.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project } from '../domain/entities/Project';
import { ProjectRepository } from '../domain/repositories/ProjectRepository';

const PROJECTS_STORAGE_KEY = 'builder_assistant_projects';

export class LocalStorageProjectRepository implements ProjectRepository {
  async save(project: Project): Promise<void> {
    try {
      const projects = await this.findAll();
      const updatedProjects = [...projects, project];
      await AsyncStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updatedProjects));
    } catch (error) {
      throw new Error(`Failed to save project: ${error}`);
    }
  }

  async findById(id: string): Promise<Project | null> {
    try {
      const projects = await this.findAll();
      return projects.find(project => project.id === id) || null;
    } catch (error) {
      throw new Error(`Failed to find project: ${error}`);
    }
  }

  async findAll(): Promise<Project[]> {
    try {
      const projectsJson = await AsyncStorage.getItem(PROJECTS_STORAGE_KEY);
      if (!projectsJson) {
        return [];
      }
      
      const projects = JSON.parse(projectsJson);
      // Convert date strings back to Date objects
      return projects.map(this.deserializeProject);
    } catch (error) {
      throw new Error(`Failed to retrieve projects: ${error}`);
    }
  }

  async findByStatus(status: string): Promise<Project[]> {
    try {
      const projects = await this.findAll();
      return projects.filter(project => project.status === status);
    } catch (error) {
      throw new Error(`Failed to find projects by status: ${error}`);
    }
  }

  async update(project: Project): Promise<void> {
    try {
      const projects = await this.findAll();
      const index = projects.findIndex(p => p.id === project.id);
      
      if (index === -1) {
        throw new Error('Project not found');
      }
      
      projects[index] = project;
      await AsyncStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch (error) {
      throw new Error(`Failed to update project: ${error}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const projects = await this.findAll();
      const filteredProjects = projects.filter(project => project.id !== id);
      await AsyncStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(filteredProjects));
    } catch (error) {
      throw new Error(`Failed to delete project: ${error}`);
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const project = await this.findById(id);
      return project !== null;
    } catch (error) {
      throw new Error(`Failed to check project existence: ${error}`);
    }
  }

  private deserializeProject(projectData: any): Project {
    return {
      ...projectData,
      startDate: new Date(projectData.startDate),
      expectedEndDate: new Date(projectData.expectedEndDate),
      phases: projectData.phases.map((phase: any) => ({
        ...phase,
        startDate: new Date(phase.startDate),
        endDate: new Date(phase.endDate)
      })),
      materials: projectData.materials.map((material: any) => ({
        ...material,
        estimatedDeliveryDate: material.estimatedDeliveryDate 
          ? new Date(material.estimatedDeliveryDate) 
          : undefined
      }))
    };
  }
}