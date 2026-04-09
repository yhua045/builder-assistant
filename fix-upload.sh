sed -i '' '/totalInput.props.onChangeText(.*);/a \
    }); \
    await act(async () => { \
      const picker = root.findByProps({ testID: '\''quotation-project-picker-row'\'' }); \
      picker.props.onPress(); \
    }); \
    await act(async () => { \
      const item = root.findByProps({ testID: '\''mock-project-item-proj1'\'' }); \
      item.props.onPress(); \
' __tests__/unit/QuotationScreen.upload.test.tsx
