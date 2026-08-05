import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import Colors from '@/constants/Colors';
import { BaseText as Text } from '@/components/ui/Base';

interface StreakDisplayProps {
  currentStreak: number;
  lastSevenDaysActivity: Record<string, boolean>;
}

export default function StreakDisplay({ currentStreak, lastSevenDaysActivity }: StreakDisplayProps) {
  // Get current date for calculating days
  const today = new Date();
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Monday to Sunday
  
  // Generate the last 7 days starting from Monday
  const getWeekDays = () => {
    const days = [];
    const todayDayOfWeek = today.getDay();
    const daysFromMonday = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1; // Sunday = 0, so we need to adjust
    
    // Start from Monday of current week
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - daysFromMonday + i);
      days.push(date);
    }
    return days;
  };

  const weekDays = getWeekDays();

  // Format date to YYYY-MM-DD in local timezone (not UTC)
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Convert the activity data to match our dates
  const getActivityForDate = (date: Date): boolean => {
    const dateStr = formatLocalDate(date); // Use local date, not UTC
    return lastSevenDaysActivity[dateStr] || false;
  };

  // Check if user had a perfect week (all 7 days active)
  const isPerfectWeek = weekDays.every(date => getActivityForDate(date));

  // Check if current streak is broken (was active yesterday but not today)
  const isStreakBroken = currentStreak === 0 && Object.values(lastSevenDaysActivity).some(active => active);

  // Get ghost image for a specific day
  const getGhostImage = (date: Date, index: number) => {
    const isActive = getActivityForDate(date);
    const isSunday = index === 6; // Sunday is the last day (index 6)
    
    if (isSunday && isPerfectWeek) {
      return require('@/assets/images/home/streaks/colors.png'); // Party hat ghost
    } else if (isActive) {
      return require('@/assets/images/home/streaks/pink.png'); // Pink ghost
    } else if (date <= today) {
      return require('@/assets/images/home/streaks/blue.png'); // Blue ghost for missed days
    } else {
      return require('@/assets/images/home/streaks/white.png'); // White ghost for future days
    }
  };

  // Get motivational message
  const getMessage = () => {
    if (isStreakBroken) {
      return "Yikes! Your streak broke!";
    } else if (currentStreak > 7) {
      return `You ate! ${currentStreak} days streak!`;
    } else if (currentStreak >= 1) {
      return `${currentStreak} days streak!`;
    } else {
      return "Start your streak today!";
    }
  };

  return (
    <View style={styles.container}>
      {/* Week View with Ghosts */}
      <View style={styles.weekContainer}>
        {weekDays.map((date, index) => {
          const ghostImage = getGhostImage(date, index);
          
          return (
            <View key={index} style={styles.dayContainer}>
              <View style={styles.ghostContainer}>
                <Image 
                  source={ghostImage}
                  style={styles.ghostImage}
                  // resizeMode="center"
                />
              </View>
              <Text style={styles.dayLabel}>{dayLabels[index]}</Text>
            </View>
          );
        })}
      </View>

      {/* Motivational Text */}
      <Text style={styles.motivationText}>
        {getMessage()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  weekContainer: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 229, 138, 0.51)',  // FFE58A
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
    gap: 10
  },
  dayContainer: {
    alignItems: 'center',
    marginHorizontal: 4,
    flex: 1,
  },
  ghostContainer: {
    width: 40,
    height: 55,
    backgroundColor: Colors.white,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  ghostImage: {
    width: '100%',
    height: '100%',
  },
  dayLabel: {
    fontSize: 16,
    color: Colors.black,
    fontWeight: '600',
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  motivationText: {
    fontSize: 20,
    color: Colors.primary, // Pink color to match the screenshot
    textAlign: 'center',
    fontWeight: '600',
  },
});