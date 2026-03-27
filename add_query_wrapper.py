import re
import glob

files = [
    '__tests__/unit/InvoiceForm.test.tsx',
    '__tests__/unit/InvoiceScreen.test.tsx',
    '__tests__/integration/InvoiceScreen.integration.test.tsx',
    '__tests__/integration/SnapReceiptCamera.integration.test.tsx'
]

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()

    # Add import if missing
    if "wrapWithQuery" not in content:
        import_stmt = "import { wrapWithQuery } from '../utils/queryClientWrapper';\n"
        
        # Determine relative path correctly for utils
        if 'unit' in filepath or 'integration' in filepath:
            import_stmt = "import { wrapWithQuery } from '../utils/queryClientWrapper';\n"
        
        content = re.sub(r'(import React.*?;\n)', r'\1' + import_stmt, content, count=1)
        
    # Replace renderer.create(<Component ... />) with renderer.create(wrapWithQuery(<Component ... />))
    # Note: Component names might vary or span multiple lines. Instead of regex, I'll just replace 
    content = re.sub(r'renderer\.create\(\s*(<[^>]+?(?:>|/>)(?:[\s\S]*?</[^>]+>)?)\s*\)', r'renderer.create(wrapWithQuery(\1))', content, flags=re.DOTALL)
    
    # Replace render(<Component ... />) with render(wrapWithQuery(<Component ... />))
    content = re.sub(r'(\s+)render\(\s*(<[^>]+?(?:>|/>)(?:[\s\S]*?</[^>]+>)?)\s*\)', r'\1render(wrapWithQuery(\2))', content, flags=re.DOTALL)

    with open(filepath, 'w') as f:
        f.write(content)

print("Done")