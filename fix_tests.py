import os
import re

def mock_useContacts(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if "useContacts" in content and "jest.mock" in content:
        return
        
    # add mock at top after imports
    mock_str = "\nчноїjest.mock('../../src/hooks/useContacts', () => ({ useContacts: () => ({ data: [], isLoading: false, error: null }) }));\n"
    # Or actually wait, just mocking Tanstack query is better? Or modifying test query wrappers?
