import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
import useContacts from '../../hooks/useContacts';

interface Props {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
  /** Called when user taps "+ Add" with the current search query */
  onQuickAdd?: (initialName: string) => void;
}

const ContactSelector: React.FC<Props> = ({ label, value, onChange, error, onQuickAdd }) => {
  const { search } = useContacts();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<any>>([]);
  const [isFocused, setIsFocused] = useState(false);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // In tests we prefer immediate search to avoid timers leaking after teardown
    if ((globalThis as any).process?.env?.NODE_ENV === 'test') {
      const res = search(query as string);
      // handle both synchronous and promise-returning search implementations
      if (res && typeof (res as any).then === 'function') {
        (res as Promise<any>).then((r) => setResults(r));
      } else {
        setResults(res as any);
      }
      return;
    }

    timerRef.current = (setTimeout(async () => {
      const res = await search(query);
      setResults(res);
    }, 300) as unknown) as number;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    if (value) {
      // If parent supplies an initial value (id), show it as query temporarily.
      setQuery(String(value));
    }
  }, [value]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={query}
        onChangeText={(text) => setQuery(text)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        placeholder="Search contacts"
        className="border border-border rounded p-2 bg-card text-foreground"
      />
      {isFocused && (results.length > 0 || (query.length > 0 && onQuickAdd)) && (
        <View style={styles.dropdown}>
          <ScrollView style={styles.list} nestedScrollEnabled>
            {results.map((item) => (
              <Pressable 
                key={item.id}
                onPress={() => { 
                  onChange(item.id); 
                  setQuery(item.name); 
                  setResults([]); 
                  setIsFocused(false); 
                }}
                className="p-3 border-b border-border"
              >
                <Text className="text-foreground">{item.name} — {item.title}</Text>
              </Pressable>
            ))}
            {query.length > 0 && onQuickAdd && (
              <Pressable
                testID="contact-selector-quick-add-btn"
                onPress={() => {
                  setIsFocused(false);
                  onQuickAdd(query);
                }}
                className="p-3 border-t border-border"
              >
                <Text style={styles.quickAddText}>+ Add "{query}"</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  list: {
    flexGrow: 0,
  },
  label: {
    marginBottom: 6,
  },
  error: {
    color: 'red',
  },
  quickAddText: {
    color: '#3B82F6',
    fontWeight: '500',
  },
});

export default ContactSelector;
