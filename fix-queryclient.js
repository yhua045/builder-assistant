const fs = require('fs');

function replaceStr(file, search, replace) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(search, replace);
  fs.writeFileSync(file, content);
}

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
  replaceStr(file, /from\s+['"]\.\.\/\.\.\/\.\.\/\.\.\/__tests__\/utils\/queryClientWrapper['"]/g, 
    "from '../../../../../__tests__/utils/queryClientWrapper'");
}

replaceStr('src/features/projects/tests/unit/useProjectTimeline.test.ts', 
  /c \=\>/g, "(c: any) =>");

