const fs = require('fs');
const path = require('path');

const mappings = [
  // PROJECTS
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?pages\/projects\/([A-Za-z0-9_]+)\1/g, to: "$1@/features/projects/screens/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?components\/projects\/([A-Za-z0-9_]+)\1/g, to: "$1@/features/projects/components/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?components\/(ManualProjectEntry|ProjectCard|ProjectList|ProjectsList|ManualProjectEntryButton|ManualProjectEntryForm)\1/g, to: "$1@/features/projects/components/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?application\/usecases\/project\/([A-Za-z0-9_]+)\1/g, to: "$1@/features/projects/application/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?application\/dtos\/ProjectCardDto\1/g, to: "$1@/features/projects/application/ProjectCardDto$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?domain\/services\/(ProjectValidationService|ProjectWorkflowService)\1/g, to: "$1@/features/projects/domain/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?infrastructure\/repositories\/(DrizzleProjectRepository|InMemoryProjectRepository|LocalSqliteProjectRepository)\1/g, to: "$1@/features/projects/infrastructure/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?infrastructure\/mappers\/ProjectMapper\1/g, to: "$1@/features/projects/infrastructure/ProjectMapper$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?hooks\/(useProjectDetail|useProjectTimeline|useProjects|useProjectsPage|useQuotationTimeline|useQuotationsTimeline|useUpdateProject)\1/g, to: "$1@/features/projects/hooks/$2$1" },

  // QUOTATIONS
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?pages\/quotations\/([A-Za-z0-9_]+)\1/g, to: "$1@/features/quotations/screens/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?components\/quotations\/([A-Za-z0-9_]+)\1/g, to: "$1@/features/quotations/components/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?application\/usecases\/quotation\/([A-Za-z0-9_]+)\1/g, to: "$1@/features/quotations/application/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?application\/ai\/(QuotationParserFactory|IQuotationParsingStrategy)\1/g, to: "$1@/features/quotations/application/ai/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?infrastructure\/ai\/LlmQuotationParser\1/g, to: "$1@/features/quotations/infrastructure/ai/LlmQuotationParser$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?infrastructure\/repositories\/DrizzleQuotationRepository\1/g, to: "$1@/features/quotations/infrastructure/DrizzleQuotationRepository$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?hooks\/(useQuotations|useQuotationUpload|useGlobalQuotations)\1/g, to: "$1@/features/quotations/hooks/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?utils\/(normalizedQuotationToFormValues)\1/g, to: "$1@/features/quotations/hooks/$2$1" },

  // TASKS
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?pages\/tasks\/([A-Za-z0-9_]+)\1/g, to: "$1@/features/tasks/screens/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?components\/tasks\/([A-Za-z0-9_]+)\1/g, to: "$1@/features/tasks/components/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?components\/TasksList\1/g, to: "$1@/features/tasks/components/TasksList$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?application\/usecases\/task\/([A-Za-z0-9_]+)\1/g, to: "$1@/features/tasks/application/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?application\/dtos\/TaskViewDTOs\1/g, to: "$1@/features/tasks/application/TaskViewDTOs$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?application\/errors\/TaskCompletionErrors\1/g, to: "$1@/features/tasks/application/TaskCompletionErrors$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?application\/usecases\/document\/(RemoveTaskDocumentUseCase|AddTaskDocumentUseCase)\1/g, to: "$1@/features/tasks/application/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?infrastructure\/repositories\/DrizzleTaskRepository\1/g, to: "$1@/features/tasks/infrastructure/DrizzleTaskRepository$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?hooks\/(useTaskTimeline|useTaskDetails|useTaskScreen|useTaskForm|useTasks|useCameraTask|useVoiceTask|useTaskDetail)\1/g, to: "$1@/features/tasks/hooks/$2$1" },
  { from: /([\'"])(?:[A-Za-z0-9_./-]*\/)?utils\/(selectTopBlockedTasks)\1/g, to: "$1@/features/tasks/utils/$2$1" }
];

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.git' || f === 'lib' || f === 'build' || f === 'dist') continue;
    const p = path.join(dir, f);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      processDir(p);
    } else if (p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js')) {
      let content = fs.readFileSync(p, 'utf8');
      let orig = content;
      for (const m of mappings) {
        content = content.replace(m.from, m.to);
      }
      // If we used @/features, let's just make everything relative since alias might not be setup yet across __tests__
      // actually, builder-assistant uses react-native, which might not have the `@/` alias configured by default, or maybe it does? 
      // Let's replace `@/features` with the correct relative path using path.relative
      if (content !== orig) {
         fs.writeFileSync(p, content);
      }
    }
  }
}

// First pass: replace with @/features
processDir(path.join(__dirname, 'src'));
processDir(path.join(__dirname, '__tests__'));

// Second pass: resolve @/features to relative paths
function resolveRelative(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.git') continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      resolveRelative(p);
    } else if (p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js')) {
      let content = fs.readFileSync(p, 'utf8');
      if (content.includes('@/features') || content.includes('@/components') || content.includes('@/domain')) {
        content = content.replace(/([\'"])@\/(.*?)\1/g, (match, quote, relPath) => {
          const absTarget = path.join(__dirname, 'src', relPath);
          let relativeDir = path.relative(path.dirname(p), absTarget);
          if (!relativeDir.startsWith('.')) relativeDir = './' + relativeDir;
          return `${quote}${relativeDir}${quote}`;
        });
        fs.writeFileSync(p, content);
      }
    }
  }
}
resolveRelative(path.join(__dirname, 'src'));
resolveRelative(path.join(__dirname, '__tests__'));
