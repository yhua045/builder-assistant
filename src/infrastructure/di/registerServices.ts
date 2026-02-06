import 'reflect-metadata';
import { container } from 'tsyringe';
import { DrizzleProjectRepository } from '../repositories/DrizzleProjectRepository';

// Register default implementations
container.registerSingleton('ProjectRepository', DrizzleProjectRepository);

export default container;
