#!/bin/bash
cd ~/HabitTrackerApp
FILE="src/screens/HomeScreen.js"
if [ ! -f "$FILE" ]; then
    echo "File not found"
    exit 1
fi
cp "$FILE" "$FILE.bak"
# استفاده از here-document با دقت
cat > "$FILE" << 'EOF'
import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import HabitItem from '../components/HabitItem';

const HomeScreen = ({ navigation }) => {
  const [habits, setHabits] = useState([]);
  const [layout, setLayout] = useState('grid');
  const [isToggling, setIsToggling] = useState(false);

  const loadHabits = async () => {
    try {
      const stored = await AsyncStorage.getItem('habits');
      if (stored) {
        setHabits(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading habits:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHabits();
    }, [])
  );

  useEffect(() => {
    loadHabits();
  }, []);

  const toggleLayout = useCallback(() => {
    if (isToggling) return;
    setIsToggling(true);
    setLayout((prevLayout) => (prevLayout === 'grid' ? 'list' : 'grid'));
    setTimeout(() => {
      setIsToggling(false);
    }, 350);
  }, [isToggling]);

  const deleteHabit = async (id) => {
    Alert.alert(
      'حذف عادت',
      'آیا از حذف این عادت مطمئن هستید؟',
      [
        { text: 'لغو', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            const updated = habits.filter((h) => h.id !== id);
            setHabits(updated);
            await AsyncStorage.setItem('habits', JSON.stringify(updated));
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderItem = ({ item }) => (
    <HabitItem
      item={item}
      onPress={() => navigation.navigate('HabitDetail', { habit: item })}
      onDelete={deleteHabit}
      layout={layout}
    />
  );

  const MemoizedFlatList = memo(FlatList);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>عادت‌های من</Text>
        <TouchableOpacity
          onPress={toggleLayout}
          style={styles.layoutButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name={layout === 'grid' ? 'grid-outline' : 'list-outline'}
            size={24}
            color="#007AFF"
          />
        </TouchableOpacity>
      </View>

      {habits.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="happy-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>هیچ عادتی ثبت نشده!</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddHabit')}
          >
            <Text style={styles.addButtonText}>+ افزودن عادت جدید</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <MemoizedFlatList
          data={habits}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          key={layout}
          numColumns={layout === 'grid' ? 2 : 1}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  layoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f4ff',
  },
  listContainer: {
    paddingHorizontal: 12,
    paddingBottom: 20,
    paddingTop: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#6c757d',
    marginTop: 20,
    marginBottom: 30,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 3,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;
EOF
echo "File updated successfully."
git add "$FILE"
git commit -m "Fix layout toggle lag with useCallback and memo"
git push origin main
echo "Done."