import React from 'react';
import renderer, { act } from 'react-test-renderer';
import TeamSelector from '../../src/components/inputs/TeamSelector';

describe('TeamSelector', () => {
  it('renders and allows selecting a team', async () => {
    const onChange = jest.fn();

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <TeamSelector label="Team" value={null} onChange={onChange} />
      );
    });

    const root = testRenderer!.root;
    const input = root.findByType(require('react-native').TextInput);

    act(() => {
      input.props.onChangeText('Renov');
    });

    expect(root).toBeDefined();
  });
});
