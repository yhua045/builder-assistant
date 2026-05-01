import re

file = 'src/features/quotations/screens/QuotationScreen.tsx'
with open(file, 'r') as f:
    content = f.read()

lines = content.split('\n')
for i, l in enumerate(lines):
    if l.startswith('import '):
        last_idx = i

lines.insert(last_idx + 1, "import { useScreenTracking } from '../../../../hooks/useScreenTracking';")

new_content = '\n'.join(lines)
insert_pos = new_content.find('export const QuotationScreen: React.FC<QuotationScreenProps> = (')
if insert_pos != -1:
    brace_pos = new_content.find('{', insert_pos)
    new_content = new_content[:brace_pos+1] + "\n  useScreenTracking('Quotations');" + new_content[brace_pos+1:]
    with open(file, 'w') as f:
         f.write(new_content)
    print("Done QuotationScreen")
