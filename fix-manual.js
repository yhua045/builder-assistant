const fs = require('fs');

function replaceStr(file, search, replace) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(search, replace);
  fs.writeFileSync(file, content);
}

// 1. DashboardScreen
replaceStr('src/features/dashboard/screens/DashboardScreen.tsx', 
  "import ManualProjectEntry from '../../../features/projects';", 
  "import { ManualProjectEntry } from '../../projects';");

// 2. queryClientWrapper paths
const queryClientWrapperTests = [
  'src/features/projects/tests/integration/ProjectCardPendingPaymentUpdate.integration.test.tsx',
  'src/features/projects/tests/integration/ProjectDetail.integration.test.tsx',
  'src/features/projects/tests/integration/ProjectDetailQuotes.integration.test.tsx',
  'src/features/projects/tests/integration/useProjects.integration.test.tsx',
  'src/features/projects/tests/unit/useProjects.test.tsx',
  'src/features/projects/tests/unit/useProjectTimeline.test.ts',
  'src/features/projects/tests/unit/useUpdateProject.test.tsx',
  'src/features/quotations/tests/unit/useGlobalQuotations.test.tsx',
  'src/features/quotations/tests/unit/useQuotations.test.tsx',
  'src/features/quotations/tests/unit/useQuotationTimeline.test.ts',
  'src/features/tasks/tests/integration/TaskPage.voice.integration.test.tsx'
];
for (const file of queryClientWrapperTests) {
  replaceStr(file, /from\s+['"]\.\.\/utils\/queryClientWrapper['"]/g, "from '../../../../__tests__/utils/queryClientWrapper'");
}

// 3. other specific files
replaceStr('src/features/projects/tests/integration/ProjectCardPendingPaymentUpdate.integration.test.tsx', 
  /from '\.\.\/\.\.\/src\/features\/invoices'/g, 
  "from '../../../invoices'");

replaceStr('src/features/projects/tests/unit/useProjectTimeline.test.ts', 
  /c \=\>/g, "(c: any) =>");

replaceStr('src/features/projects/tests/unit/useUpdateProject.test.tsx', 
  /c \=\>/g, "(c: any) =>");

replaceStr('src/features/quotations/infrastructure/DrizzleQuotationRepository.ts', 
  /from '\.\.\/\.\.\/\.\.\/data\/critical-path\/schema'/g, "from '../../../infrastructure/database/schema'");

replaceStr('src/features/tasks/screens/index.tsx', 
  /from '\.\.\/\.\.\/features\/projects'/g, "from '../../projects'");
replaceStr('src/features/tasks/screens/index.tsx', 
  /import \{\s*TasksList\s*\} from '\.\.\/components\/TasksList';/g, "import TasksList from '../components/TasksList';");
replaceStr('src/features/tasks/screens/index.tsx', 
  /p \=\> /g, "(p: any) => ");
replaceStr('src/features/tasks/screens/index.tsx', 
  /\(id\) \=\> /g, "(id: any) => ");

replaceStr('src/features/tasks/tests/integration/TasksScreen.cockpit.integration.test.tsx', 
  "import TasksScreen from '../../../../data/critical-path/index';", 
  "import TasksScreen from '../../screens/index';");

