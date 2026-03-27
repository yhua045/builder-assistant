with open('src/pages/invoices/InvoiceScreen.tsx', 'r') as f:
    text = f.read()

lines = text.split('\n')
# Remove trailing empty or }; lines
while lines[-1].strip() in ['', '};']:
    lines.pop()

lines.append('  return null;')
lines.append('};')

with open('src/pages/invoices/InvoiceScreen.tsx', 'w') as f:
    f.write('\n'.join(lines) + '\n')
