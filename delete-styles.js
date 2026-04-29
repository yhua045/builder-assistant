const fs = require('fs');

const path = 'src/features/projects/components/ManualProjectEntryForm.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /const styles = StyleSheet\.create\(\{[\s\S]*\}\);/g;
content = content.replace(regex, '');

fs.writeFileSync(path, content);
