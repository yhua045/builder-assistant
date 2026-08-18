import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, Pressable } from 'react-native';
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
    <View className="relative z-10 w-full mb-4">
      <Text className="mb-1.5 font-medium text-sm text-zinc-700">{label}</Text>
      <TextInput
        value={query}
        onChangeText={(text) => setQuery(text)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        placeholder="Search contacts"
        className="h-11 border border-zinc-300 rounded-lg px-3 text-base bg-white text-zinc-900"
      />
      {isFocused && (results.length > 0 || (query.length > 0 && onQuickAdd)) && (
        <View className="absolute top-[100%] left-0 right-0 bg-white border border-[#ccc] rounded-lg max-h-[200px] z-[1000] shadow-md elevation-5 mt-1">
          <ScrollView className="flex-grow-0" nestedScrollEnabled>
            {results.map((item) => (
              <Pressable 
                key={item.id}
                onPress={() => { 
                  onChange(item.id); 
                  setQuery(item.name); 
                  setResults([]); 
                  setIsFocused(false); 
                }}
                className="p-3 border-b border-zinc-100 last:border-b-0"
              >
                <Text className="text-zinc-900 text-sm font-medium">{item.name} — <Text className="text-zinc-500 font-normal">{item.title}</Text></Text>
              </Pressable>
            ))}
            {query.length > 0 && onQuickAdd && (
              <Pressable
                testID="contact-selector-quick-add-btn"
                onPress={() => {
                  setIsFocused(false);
                  onQuickAdd(query);
                }}
                className="p-3 border-t border-zinc-200"
              >
                <Text className="text-blue-500 font-medium text-sm">+ Add "{query}"</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}
      {error ? <Text className="text-red-500 text-sm mt-1">{error}</Text> : null}
    </View>
  );
};

export default ContactSelector;
