import {
  validateLookupFile,
  CriticalPathLookupFile,
} from '../../src/data/critical-path/schema';

const validFile: CriticalPathLookupFile = {
  project_type: 'complete_rebuild',
  state: 'NSW',
  title: 'Complete rebuild (NSW canonical)',
  version: '1.0.0',
  tasks: [
    {
      id: 'nsw-cr-01',
      title: 'DA / CDC Approval',
      recommended_start_offset_days: 0,
      critical_flag: true,
      order: 1,
    },
    {
      id: 'nsw-cr-02',
      title: 'Heritage Impact Statement',
      critical_flag: true,
      condition: 'heritage_flag === true',
      order: 2,
    },
  ],
};

describe('validateLookupFile', () => {
  it('returns valid for a well-formed lookup file', () => {
    const result = validateLookupFile(validFile as any);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects file missing project_type', () => {
    const bad = { ...validFile, project_type: undefined };
    const result = validateLookupFile(bad as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /project_type/.test(e))).toBe(true);
  });

  it('rejects file missing tasks array', () => {
    const bad = { ...validFile, tasks: undefined };
    const result = validateLookupFile(bad as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /tasks/.test(e))).toBe(true);
  });

  it('rejects file with empty tasks array', () => {
    const bad = { ...validFile, tasks: [] };
    const result = validateLookupFile(bad as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /tasks/.test(e))).toBe(true);
  });

  it('rejects task entry that contains a steps/sub-tasks array', () => {
    const bad = {
      ...validFile,
      tasks: [
        {
          ...(validFile.tasks[0]),
          steps: ['step 1', 'step 2'], // forbidden sub-task array
        },
      ],
    };
    const result = validateLookupFile(bad as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /sub.task|steps|nested/i.test(e))).toBe(true);
  });

  it('rejects task entry that contains a subtasks array', () => {
    const bad = {
      ...validFile,
      tasks: [
        {
          ...(validFile.tasks[0]),
          subtasks: [{ id: 'x', title: 'sub' }],
        },
      ],
    };
    const result = validateLookupFile(bad as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /sub.task|subtasks|nested/i.test(e))).toBe(true);
  });

  it('rejects task missing required id', () => {
    const bad = {
      ...validFile,
      tasks: [{ title: 'No ID', critical_flag: true, order: 1 }],
    };
    const result = validateLookupFile(bad as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /id/.test(e))).toBe(true);
  });

  it('rejects task missing required title', () => {
    const bad = {
      ...validFile,
      tasks: [{ id: 'x', critical_flag: true, order: 1 }],
    };
    const result = validateLookupFile(bad as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /title/.test(e))).toBe(true);
  });

  it('rejects task with title over 60 chars', () => {
    const bad = {
      ...validFile,
      tasks: [{ id: 'x', title: 'A'.repeat(61), critical_flag: true, order: 1 }],
    };
    const result = validateLookupFile(bad as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /60|title/i.test(e))).toBe(true);
  });
});
