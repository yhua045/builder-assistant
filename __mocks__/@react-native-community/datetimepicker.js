const React = require('react');
const { View } = require('react-native');

function MockDateTimePicker(props) {
  return React.createElement(View, props, props.children);
}

module.exports = MockDateTimePicker;
module.exports.default = MockDateTimePicker;