import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import useContacts from '../../hooks/useContacts';

interface Props {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
}

const ContactSelector: React.FC<Props> = ({ label, value, onChange, error }) => {
  const { search } = useContacts();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<any>>([]);
  const [isFocused, setIsFocused] = useState(false);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
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
      <Text style={{ marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={query}
        onChangeText={(text) => setQuery(text)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        placeholder="Search contacts"
        className="border border-border rounded p-2 bg-card text-foreground"
      />
      {isFocused && results.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable 
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
            )}
            style={styles.list}
          />
        </View>
      )}
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
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
});

export default ContactSelector;
