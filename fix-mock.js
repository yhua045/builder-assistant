const fs = require('fs');
let content = fs.readFileSync('__tests__/unit/QuotationScreen.upload.test.tsx', 'utf8');
content = content.replace(
  /ProjectPickerModal: \(\{[^\}]+\}\) => \{[^\}]+\},/,
  `ProjectPickerModal: ({ onSelect, testID }: any) => { const React = require('react'); const RN = require('react-native'); return React.createElement(RN.View, { testID: testID || "mock-project-picker-modal" }, React.createElement(RN.TouchableOpacity, { testID: "mock-project-item-proj1", onPress: () => onSelect({ id: "proj1", name: "Reno" }) })); },`
);
fs.writeFileSync('__tests__/unit/QuotationScreen.upload.test.tsx', content);
