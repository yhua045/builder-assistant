const fs = require('fs');

function replaceStr(file, search, replace) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(search, replace);
    fs.writeFileSync(file, content);
  }
}

replaceStr('src/features/projects/tests/unit/components/ManualProjectEntry.test.tsx',
  "require('../../../../../components/CriticalPathPreview')",
  "require('../CriticalPathPreview')");

replaceStr('src/features/projects/tests/unit/components/ManualProjectEntryForm.test.tsx',
  "require('../../../../../components/CriticalPathPreview/CriticalPathPreview')",
  "require('../CriticalPathPreview/CriticalPathPreview')");
  
replaceStr('src/features/projects/tests/integration/ManualProjectEntryForm.integration.test.tsx',
  "jest.mock('../../../../../components/inputs/DatePickerInput'",
  "jest.mock('../../../../../src/components/inputs/DatePickerInput'"); 

replaceStr('src/features/quotations/tests/unit/QuotationDetail.test.tsx',
  "jest.mock('../../../../../components/quotations/QuotationForm'",
  "jest.mock('../../../components/QuotationForm'");
  
replaceStr('src/features/quotations/tests/unit/QuotationScreen.test.tsx',
  "jest.mock('../../../../../components/quotations/QuotationForm'",
  "jest.mock('../../../components/QuotationForm'");
  
replaceStr('src/features/quotations/tests/unit/QuotationScreen.upload.test.tsx',
  "jest.mock('../../../../../components/quotations/QuotationForm'",
  "jest.mock('../../../components/QuotationForm'");
  
replaceStr('src/features/quotations/tests/integration/QuotationScreen.integration.test.tsx',
  "jest.mock('../../../../../components/inputs/DatePickerInput'",
  "jest.mock('../../../../../src/components/inputs/DatePickerInput'");
  
replaceStr('src/features/tasks/tests/unit/screens/TaskDetailsPage.test.tsx',
  "require('../../../../../components/tasks/TaskPhotoPreview')",
  "require('../../../components/TaskPhotoPreview')");

replaceStr('src/features/tasks/tests/unit/screens/TaskScreen.test.tsx',
  "jest.mock('../../../../../features/tasks/components/TaskPhotoPreview'",
  "jest.mock('../../../components/TaskPhotoPreview'");

