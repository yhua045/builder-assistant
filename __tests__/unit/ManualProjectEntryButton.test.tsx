import React from 'react';
import renderer from 'react-test-renderer';
import { ManualProjectEntryButton } from '../../src/components/ManualProjectEntryButton';

describe('ManualProjectEntryButton', () => {
  it('renders without crashing and shows the button', () => {
    const tree = renderer.create(<ManualProjectEntryButton />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
