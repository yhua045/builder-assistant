const fs = require('fs');
let code = fs.readFileSync('__tests__/unit/QuotationScreen.upload.test.tsx', 'utf8');

code = code.replace(
  /ProjectPickerModal: \(\) => null,/,
  `ProjectPickerModal: (props: any) => { const React = require('react'); const RN = require('react-native'); return React.createElement(RN.View, { testID: 'mock-project-picker-modal' }, React.createElement(RN.TouchableOpacity, { testID: 'mock-project-item-proj1', onPress: () => props.onSelect({ id: 'proj1', name: 'proj1' }) })); },`
);

fs.writeFileSync('__tests__/unit/QuotationScreen.upload.test.tsx', code);
