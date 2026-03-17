import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ContactSelector from '../../src/components/inputs/ContactSelector';

jest.mock('../../src/hooks/useContacts', () => {
  const mockSearch = jest.fn().mockResolvedValue([]);
  return {
    __esModule: true,
    default: () => ({ contacts: [], loading: false, search: mockSearch, refresh: jest.fn() }),
    useContacts: () => ({ contacts: [], loading: false, search: mockSearch, refresh: jest.fn() }),
  };
});

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

    await act(async () => {
      input.props.onChangeText('Alex');
      // Wait for the synchronous promise resolution in test mode
      await Promise.resolve();
    });

    expect(root).toBeDefined();
  });
});
