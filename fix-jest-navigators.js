const fs = require('fs');

function replaceStr(file, search, replace) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(search, replace);
    fs.writeFileSync(file, content);
  }
}

// In TasksScreen.cockpit.integration.test.tsx
replaceStr('src/features/tasks/tests/integration/TasksScreen.cockpit.integration.test.tsx',
  "jest.mock('@react-navigation/native', () => {",
  "jest.mock('@react-navigation/native-stack', () => ({ createNativeStackNavigator: () => ({ Navigator: ({children}: any) => children, Screen: () => null }) }));\njest.mock('@react-navigation/native', () => {");
  
// In TaskPage.voice.integration.test.tsx
replaceStr('src/features/tasks/tests/integration/TaskPage.voice.integration.test.tsx',
  "jest.mock('@react-navigation/native', () => {",
  "jest.mock('@react-navigation/native-stack', () => ({ createNativeStackNavigator: () => ({ Navigator: ({children}: any) => children, Screen: () => null }) }));\njest.mock('@react-navigation/native', () => {");

