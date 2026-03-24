import sys

with open('src/components/ManualProjectEntryForm.tsx', 'r') as f:
    txt = f.read()

txt = txt.replace('  projectId?: string | null;', '''  projectId?: string | null;
  excludeCriticalTasks?: boolean;
  initialValues?: {
    name?: string;
    address?: string;
    description?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    budget?: string;
    projectType?: string;
    state?: string;
    notes?: string;
  };''')

txt = txt.replace(
  'const ManualProjectEntryForm: React.FC<Props> = ({ visible = true, onSave, onCancel, onTasksAdded, criticalPathHook, projectId }) => {',
  'const ManualProjectEntryForm: React.FC<Props> = ({ visible = true, onSave, onCancel, onTasksAdded, criticalPathHook, projectId, excludeCriticalTasks, initialValues }) => {'
)

txt = txt.replace("const [name, setName] = React.useState('');", "const [name, setName] = React.useState(initialValues?.name ?? '');")
txt = txt.replace("const [projectType, setProjectType] = React.useState('complete_rebuild');", "const [projectType, setProjectType] = React.useState(initialValues?.projectType ?? 'complete_rebuild');")
txt = txt.replace("const [state, setStateLoc] = React.useState('NSW');", "const [state, setStateLoc] = React.useState(initialValues?.state ?? 'NSW');")
txt = txt.replace("const [description, setDescription] = React.useState('');", "const [description, setDescription] = React.useState(initialValues?.description ?? '');")
txt = txt.replace("const [address, setAddress] = React.useState('');", "const [address, setAddress] = React.useState(initialValues?.address ?? '');")
txt = txt.replace("const [startDate, setStartDate] = React.useState<Date | null>(null);", "const [startDate, setStartDate] = React.useState<Date | null>(initialValues?.startDate ?? null);")
txt = txt.replace("const [endDate, setEndDate] = React.useState<Date | null>(null);", "const [endDate, setEndDate] = React.useState<Date | null>(initialValues?.endDate ?? null);")
txt = txt.replace("const [budget, setBudget] = React.useState('');", "const [budget, setBudget] = React.useState(initialValues?.budget ?? '');")
txt = txt.replace("const [notes, setNotes] = React.useState('');", "const [notes, setNotes] = React.useState(initialValues?.notes ?? '');")

txt = txt.replace("""  useEffect(() => {
    if (projectId) setFormStep('tasks');
  }, [projectId]);""", """  useEffect(() => {
    if (projectId && !excludeCriticalTasks) setFormStep('tasks');
  }, [projectId, excludeCriticalTasks]);""")

txt = txt.replace("""      setFormStep('tasks');""", """      if (excludeCriticalTasks) { 
        handleSave(); 
      } else { 
        setFormStep('tasks'); 
      }""")

with open('src/components/ManualProjectEntryForm.tsx', 'w') as f:
    f.write(txt)
