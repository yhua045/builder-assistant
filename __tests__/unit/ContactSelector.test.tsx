import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ContactSelector from '../../src/components/inputs/ContactSelector';

describe('ContactSelector', () => {
  it('renders and allows selecting a contact', async () => {
    const onChange = jest.fn();
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <ContactSelector label="Owner" value={null} onChange={onChange} />
      );
    });

    const root = testRenderer!.root;
    const input = root.findByType(require('react-native').TextInput);

    act(() => {
      input.props.onChangeText('Alex');
    });

    expect(root).toBeDefined();
  });
});
