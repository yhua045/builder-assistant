const fs = require('fs');

function replaceRegex(file, search, replace) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(search, replace);
    fs.writeFileSync(file, content);
  }
}

replaceRegex('src/features/tasks/tests/unit/screens/TaskDetailsPage.test.tsx',
  /const SOURCE_FILE = path\.join\(__dirname, .*\);/g,
  "const SOURCE_FILE = path.join(__dirname, '../../../screens/TaskDetailsPage.tsx');");
  
replaceRegex('src/features/tasks/tests/unit/screens/TaskScreen.test.tsx',
  /const SOURCE_FILE = path\.join\(__dirname, .*\);/g,
  "const SOURCE_FILE = path.join(__dirname, '../../../screens/TaskScreen.tsx');");

replaceRegex('src/features/projects/tests/unit/components/ManualProjectEntryForm.test.tsx',
  /require\(['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/components\/CriticalPathPreview\/CriticalPathPreview['"]\)/g,
  "require('../../../components/CriticalPathPreview/CriticalPathPreview')");
  
replaceRegex('src/features/projects/tests/integration/ManualProjectEntryForm.integration.test.tsx',
  /jest\.mock\(.*DatePickerInput.*/g,
  "jest.mock('../../../../../components/inputs/DatePickerInput', () => {");
  
replaceRegex('src/features/tasks/tests/unit/screens/TaskScreen.test.tsx',
  /jest\.mock\(['"].*TaskPhotoPreview['"]/g,
  "jest.mock('../../../components/TaskPhotoPreview'");

replaceRegex('src/features/quotations/tests/unit/useQuotations.test.tsx',
  /jest\.mock\(['"].*QuotationRepository['"]/g,
  "jest.mock('../../../../../domain/repositories/QuotationRepository'");

replaceRegex('src/features/quotations/tests/integration/QuotationScreen.integration.test.tsx',
  /jest\.mock\(['"].*DatePickerInput['"]/g,
  "jest.mock('../../../../../components/inputs/DatePickerInput'");
