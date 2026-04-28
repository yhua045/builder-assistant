import { DrizzleProjectRepository } from '../../features/projects/infrastructure/DrizzleProjectRepository';

type Factory = () => any;

const registry = new Map<string, any>();
const factories = new Map<string, Factory>();

export function registerInstance<T>(key: string, instance: T) {
  registry.set(key, instance);
}

export function registerFactory(key: string, factory: Factory) {
  factories.set(key, factory);
}

export function resolve<T>(key: string): T {
  if (registry.has(key)) {
    const inst = registry.get(key) as T;
    try {
      // Log resolved implementation for easier debugging in dev
       
      console.debug(`[DI] resolve(${key}) ->`, inst && (inst.constructor ? inst.constructor.name : typeof inst));
    } catch {}
    return inst;
  }
  if (factories.has(key)) {
    const inst = factories.get(key)!();
    registry.set(key, inst);
    try {
       
      console.debug(`[DI] resolve(${key}) via factory ->`, inst && (inst.constructor ? inst.constructor.name : typeof inst));
    } catch {}
    return inst as T;
  }

  // Provide sensible default for ProjectRepository to avoid wiring in tests
  if (key === 'ProjectRepository') {
    const repo = new DrizzleProjectRepository();
    registry.set(key, repo);
    return repo as unknown as T;
  }

  throw new Error(`No binding found for key: ${key}`);
}

export function clearContainer() {
  registry.clear();
  factories.clear();
}
