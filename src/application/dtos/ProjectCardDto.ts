import { ProjectStatus } from "../../domain/entities/Project";

export interface ProjectCardDto {
  id: string;
  owner: string;
  address: string;
  status: ProjectStatus;
  contact: string;
  lastCompletedTask: {
    title: string;
    completedDate: string;
  };
  upcomingTasks: {
    title: string;
    dueDate: string;
  }[];
}
