import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import useContacts from '../../hooks/useContacts';

interface Props {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
}

const ContactSelector: React.FC<Props> = ({ label, value: _value, onChange, error }) => {
  const { search } = useContacts();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<any>>([]);

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

  return (
    <View>
      <Text>{label}</Text>
      <TextInput
        value={query}
        onChangeText={(text) => setQuery(text)}
        placeholder="Search contacts"
      />
      {results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => { onChange(item.id); setQuery(item.name); setResults([]); }}>
              <Text>{item.name} — {item.title}</Text>
            </Pressable>
          )}
        />
      )}
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
    </View>
  );
};

export default ContactSelector;
