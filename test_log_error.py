import re
with open('__tests__/integration/useProjects.integration.test.tsx', 'r') as f:
    text = f.read()
text = text.replace('expect(latest.loading).toBe(false);', 'console.log("Error from hook:", latest.error);\n    expect(latest.loading).toBe(false);')
with open('__tests__/integration/useProjects.integration.test.tsx', 'w') as f:
    f.write(text)
