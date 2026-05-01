import re

file = 'src/pages/profile/index.tsx'
with open(file, 'r') as f:
    content = f.read()

# Add imports
if 'useAnalyticsOptOut' not in content:
    lines = content.split('\n')
    last_import_idx = -1
    for i, l in enumerate(lines):
        if l.startswith('import '):
            last_import_idx = i
    lines.insert(last_import_idx + 1, "import { useAnalyticsOptOut } from '../../hooks/useAnalyticsOptOut';")
    lines.insert(last_import_idx + 2, "import { Switch } from 'react-native';")
    content = '\n'.join(lines)

# Add hook call
if 'const { isOptedOut, setOptOut } = useAnalyticsOptOut();' not in content:
    pos = content.find('export default function ProfileScreen() {')
    if pos != -1:
        brace_pos = content.find('{', pos)
        content = content[:brace_pos+1] + "\n  const { isOptedOut, setOptOut } = useAnalyticsOptOut();" + content[brace_pos+1:]

# Add UI component
if 'Analytics & Crash Reports' not in content:
    ui_component = """
        <View className="bg-card rounded-2xl p-6 mb-6 mt-6">
          <Text className="text-foreground font-semibold text-base mb-4">Privacy</Text>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-foreground font-medium">Analytics & Crash Reports</Text>
              <Text className="text-muted-foreground text-sm mt-0.5">
                Help improve the app by sharing usage data
              </Text>
            </View>
            <Switch
              value={!isOptedOut}
              onValueChange={(v) => setOptOut(!v)}
              trackColor={{ false: '#767577', true: '#f97316' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>
"""
    # Insert before the logout button or at the bottom of ScrollView
    insert_pos = content.rfind('<View className="p-6">')
    if insert_pos == -1:
        insert_pos = content.find('</ScrollView>')
    if insert_pos != -1:
        content = content[:insert_pos] + ui_component + content[insert_pos:]

with open(file, 'w') as f:
    f.write(content)
print("Done Profile")
