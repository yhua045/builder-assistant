import os
import re

files = [
    ('src/features/tasks/screens/TaskScreen.tsx', 'Tasks', 'TaskScreen'),
    ('src/features/invoices/screens/InvoiceScreen.tsx', 'Invoices', 'InvoiceScreen'),
    ('src/features/quotations/screens/QuotationScreen.tsx', 'Quotations', 'QuotationScreen'),
    ('src/features/payments/screens/PaymentsScreen.tsx', 'Payments', 'PaymentsScreen'),
    ('src/features/receipts/screens/SnapReceiptScreen.tsx', 'SnapReceipt', 'SnapReceiptScreen'),
    ('src/pages/profile/index.tsx', 'Profile', 'ProfileScreen'),
    ('src/features/tasks/screens/TaskDetailsPage.tsx', 'TaskDetail', 'TaskDetailsPage'),
    ('src/features/invoices/screens/InvoiceDetailPage.tsx', 'InvoiceDetail', 'InvoiceDetailPage'),
    ('src/features/payments/screens/PaymentDetails.tsx', 'PaymentDetail', 'PaymentDetails'),
]

for file, screen_name, func_name in files:
    if not os.path.exists(file):
        print(f"Not found: {file}")
        continue
    
    with open(file, 'r') as f:
        content = f.read()
        
    if "useScreenTracking" in content:
        print(f"Skipping {file} - already has useScreenTracking")
        continue

    # count depth for correct import path
    depth = file.count('/') - 1
    import_path = '../' * depth + 'hooks/useScreenTracking'
    
    # insert import after last import
    lines = content.split('\n')
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.startswith('import '):
            last_import_idx = i
            
    lines.insert(last_import_idx + 1, f"import {{ useScreenTracking }} from '{import_path}';")
    
    # insert hook
    new_content = '\n'.join(lines)
    # locate functional component
    regex = rf"(function {func_name}\([^)]*\)\s*{{|const {func_name}\s*=\s*(?:<[^>]*>)?\s*\([^)]*\)\s*=>\s*{{)"
    match = re.search(regex, new_content)
    
    if match:
        insert_pos = match.end()
        new_content = new_content[:insert_pos] + f"\n  useScreenTracking('{screen_name}');" + new_content[insert_pos:]
        with open(file, 'w') as f:
            f.write(new_content)
        print(f"Instrumented {file}")
    else:
        print(f"Could not find function {func_name} in {file}")

