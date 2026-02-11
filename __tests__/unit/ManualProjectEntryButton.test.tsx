import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { ManualProjectEntryButton } from '../../src/components/ManualProjectEntryButton';

describe('ManualProjectEntryButton', () => {
  it('renders without crashing and shows the button', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(<ManualProjectEntryButton />);
    });

    const tree = testRenderer!.toJSON();
    act(() => {
      testRenderer!.unmount();
    });
    expect(tree).toMatchSnapshot();
  });
});
