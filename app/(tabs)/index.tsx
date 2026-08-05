import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Pressable,
} from 'react-native';
import { useAuth } from '@/lib/context/AuthContext';
import StreakDisplay from '@/components/ui/StreakDisplay';
import WebViewModal from '@/components/modals/WebViewModal';
import Colors from '@/constants/Colors';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { BaseText as Text } from '@/components/ui/Base';

export default function HomeTab() {
  const { backendUser, refreshUserDataSilently } = useAuth();

  // Refresh streaks data when tab is focused
  useFocusEffect(
    useCallback(() => {
      refreshUserDataSilently();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );
  const [webViewModalVisible, setWebViewModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Image source={require('@/assets/images/home/bg.png')} style={styles.backgroundImage} resizeMode="cover" />

      {/* Streak Display */}
      {backendUser && (
        <View style={styles.streakContainer}>
          <StreakDisplay 
            currentStreak={backendUser.current_streak || 0}
            lastSevenDaysActivity={backendUser.last_seven_days_activity || {}}
          />
        </View>
      )}

      <View style={[styles.iconsGroup, styles.iconsGroupFirst]}>
        
        <Pressable style={styles.iconContainer} onPress={() => router.push('/soul-bot-chat')}>
          <View style={styles.iconImageContainer}>
            <Image
              source={require('@/assets/images/home/icons/soul_checkup.png')}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.iconText}>Soul Check-up</Text>
        </Pressable>

        <Pressable style={styles.iconContainer} onPress={() => setWebViewModalVisible(true)}>
          <View style={styles.iconImageContainer}>
            <Image
              source={require('@/assets/images/home/icons/mind_workouts.png')}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.iconText}>Mind Workouts</Text>
        </Pressable>
      </View>

      <View style={[styles.iconsGroup, styles.iconsGroupSecond]}>
        <Pressable style={styles.iconContainer} onPress={() => router.push('/explore')}>
          <View style={styles.iconImageContainer}>
            <Image
              source={require('@/assets/images/home/icons/chat_people.png')}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.iconText}>Chat with real people</Text>
        </Pressable>
        
      </View>
      
      {/* WebView Modal */}
      <WebViewModal
        visible={webViewModalVisible}
        url="https://www.zealopia.com/zeal-zone"
        title="Mind Workouts"
        onClose={() => setWebViewModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  backgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  streakContainer: {
    marginTop: 10,
    zIndex: 1,
  },

  iconsGroupFirst: {
    marginTop: 20,
  },

  iconsGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 120,
  },

  iconsGroupSecond: {
    marginTop: -20,
  },

  iconContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },

  iconImageContainer: {
    padding: 6,
    backgroundColor: '#E8DFFF',
    borderWidth: 4,
    borderColor: Colors.white,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  iconImage: {
    width: 65,
    height: 65,
  },

  iconText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.black
  }
});