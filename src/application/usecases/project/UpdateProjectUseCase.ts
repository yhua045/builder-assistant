/**
 * Application Use Case: Update Project
 *
 * Handles editing of core project fields (name, description, location, dates,
 * budget, currency, fireZone).  Protected fields — status, ownerId, propertyId,
 * phases, materials — are purposely carried through unchanged.
 *
 * Issue #176 — Track D
 */

import { ProjectRepository } from '../../../domain/repositories/ProjectRepository';

export interface UpdateProjectRequest {
  projectId: string;
  name: string;
  description?: string;
  location?: string;
  startDate?: Date;
  expectedEndDate?: Date;
  budget?: number;
  currency?: string;
  fireZone?: string;
}

export interface UpdateProjectResponse {
  success: boolean;
  errors?: string[];
}

export class UpdateProjectUseCase {
  constructor(private readonly projectRepository: ProjectRepository) {}

  async execute(request: UpdateProjectRequest): Promise<UpdateProjectResponse> {
    // ── 1. Validate name ────────────────────────────────────────────────────
    if (!request.name || request.name.trim().length === 0) {
      return { success: false, errors: ['Project name is required'] };
    }

    // ── 2. Validate date range ───────────────────────────────────────────────
    if (request.startDate && request.expectedEndDate) {
      if (request.startDate.getTime() >= request.expectedEndDate.getTime()) {
        return { success: false, errors: ['End date must be after start date'] };
      }
    }

    // ── 3. Load existing project ─────────────────────────────────────────────
    const existing = await this.projectRepository.findById(request.projectId);
    if (!existing) {
      return { success: false, errors: [`Project not found: ${request.projectId}`] };
    }

    // ── 4. Merge editable fields; preserve protected ones ────────────────────
    const updated = {
      ...existing,
      name: request.name.trim(),
      description: request.description !== undefined ? request.description : existing.description,
      location: request.location !== undefined ? request.location : existing.location,
      startDate: request.startDate !== undefined ? request.startDate : existing.startDate,
      expectedEndDate: request.expectedEndDate !== undefined ? request.expectedEndDate : existing.expectedEndDate,
      budget: request.budget !== undefined ? request.budget : existing.budget,
      currency: request.currency !== undefined ? request.currency : existing.currency,
      fireZone: request.fireZone !== undefined ? request.fireZone : existing.fireZone,
      updatedAt: new Date(),
    };

    // ── 5. Persist ────────────────────────────────────────────────────────────
    await this.projectRepository.save(updated);

    return { success: true };
  }
}
