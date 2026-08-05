import React from 'react';
import { View, StyleSheet, Image, ScrollView } from 'react-native';
import Colors from '@/constants/Colors';
import { BaseText as Text } from '@/components/ui/Base';

interface DimensionData {
  score: number;
  explanation: string;
}

interface SoulProfileData {
  dimensions_data: {
    hidden_bias?: DimensionData;
    emotional_resilience?: DimensionData;
    shadow_desires?: DimensionData;
    kindness_compassion?: DimensionData;
    imagination_creativity?: DimensionData;
    empathy_sensitivity?: DimensionData;
    self_awareness?: DimensionData;
    authenticity_vulnerability?: DimensionData;
    playfulness_curiosity?: DimensionData;
    emotional_reactivity?: DimensionData;
    meaning_purpose?: DimensionData;
  };
  summary: string;
}

interface SoulProfileDisplayProps {
  soulProfile: SoulProfileData;
}

// Map dimension keys to display names and icon paths
const dimensionConfig = {
  hidden_bias: {
    name: 'Hidden Bias',
    icon: require('@/assets/images/soul_parameters/hidden_bias.png'),
  },
  emotional_resilience: {
    name: 'Emotional Resilience', 
    icon: require('@/assets/images/soul_parameters/emotional_resilience.png'),
  },
  shadow_desires: {
    name: 'Shadow Desires',
    icon: require('@/assets/images/soul_parameters/shadow_desires.png'),
  },
  kindness_compassion: {
    name: 'Kindness',
    icon: require('@/assets/images/soul_parameters/kindness.png'),
  },
  imagination_creativity: {
    name: 'Creativity',
    icon: require('@/assets/images/soul_parameters/creativity.png'),
  },
  empathy_sensitivity: {
    name: 'Sensitivity',
    icon: require('@/assets/images/soul_parameters/sensitivity.png'),
  },
  self_awareness: {
    name: 'Self Reflection',
    icon: require('@/assets/images/soul_parameters/self_reflection.png'),
  },
  authenticity_vulnerability: {
    name: 'Vulnerability',
    icon: require('@/assets/images/soul_parameters/vulnerability.png'),
  },
  playfulness_curiosity: {
    name: 'Curiosity',
    icon: require('@/assets/images/soul_parameters/curiosity.png'),
  },
  emotional_reactivity: {
    name: 'Reflex',
    icon: require('@/assets/images/soul_parameters/reflex.png'),
  },
  meaning_purpose: {
    name: 'Purpose',
    icon: require('@/assets/images/soul_parameters/purpose.png'),
  },
};

export default function SoulProfileDisplay({ soulProfile }: SoulProfileDisplayProps) {
  // All 11 dimensions in order
  const dimensionOrder = [
    'hidden_bias',
    'emotional_resilience', 
    'shadow_desires',
    'kindness_compassion',
    'imagination_creativity',
    'empathy_sensitivity',
    'self_awareness',
    'authenticity_vulnerability',
    'playfulness_curiosity',
    'emotional_reactivity',
    'meaning_purpose',
  ];

  const getDimensionStatus = (dimensionData?: DimensionData) => {
    if (!dimensionData) {
      return 'not_measured';
    }
    return dimensionData.score > 50 ? 'depth' : 'needs_polishing';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'depth':
        return require('@/assets/images/icons/star.png');
      case 'needs_polishing':
        return require('@/assets/images/icons/drop.png');
      default:
        return null; // For now, we'll handle X icon if needed
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Title */}
      <Text style={styles.sectionTitle}>Your Soul Profile</Text>

      {/* Summary Box */}
      <View style={styles.summaryBox}>
        <Text style={styles.summaryText}>{soulProfile.summary}</Text>
      </View>

      {/* Dimensions Horizontal Scroll */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dimensionsScrollContent}
        style={styles.dimensionsScroll}
      >
        {dimensionOrder.map((dimensionKey) => {
          const dimension = soulProfile.dimensions_data[dimensionKey as keyof typeof soulProfile.dimensions_data];
          const config = dimensionConfig[dimensionKey as keyof typeof dimensionConfig];
          const status = getDimensionStatus(dimension);
          const statusIcon = getStatusIcon(status);

          return (
            <View key={dimensionKey} style={styles.dimensionItem}>
              <View style={styles.iconContainer}>
                <Image 
                  source={config.icon} 
                  style={styles.dimensionIcon}
                  resizeMode="contain"
                />
                {statusIcon && (
                  <Image 
                    source={statusIcon}
                    style={styles.statusIcon}
                    resizeMode="contain"
                  />
                )}
              </View>
              <Text style={styles.dimensionName}>
                {config.name}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <Image 
            source={require('@/assets/images/icons/drop.png')}
            style={styles.legendIcon}
            resizeMode="contain"
          />
          <Text style={styles.legendText}>= needs polishing</Text>
        </View>
        <View style={styles.legendItem}>
          <Image 
            source={require('@/assets/images/icons/star.png')}
            style={styles.legendIcon}
            resizeMode="contain"
          />
          <Text style={styles.legendText}>= depth of emotion</Text>
        </View>
      </View>

      {/* Note about unmeasured data */}
      {/* <Text style={styles.noteText}>X = data not measured yet</Text> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // paddingHorizontal: 20,
    // paddingVertical: 24,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  summaryBox: {
    backgroundColor: Colors.headerFooter,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 24,
    marginHorizontal: 16,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 19,
    color: Colors.white,
    fontWeight: '400',
  },
  dimensionsScroll: {
    marginBottom: 24,
    paddingVertical: 10,
  },
  dimensionsScrollContent: {
    // paddingHorizontal: 20,
    gap: 16,
  },
  dimensionItem: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 65,
    height: 65,
    backgroundColor: Colors.white,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.33,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  dimensionIcon: {
    width: 45,
    height: 45,
  },
  statusIcon: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
  },
  dimensionName: {
    fontSize: 13,
    color: Colors.black,
    textAlign: 'center',
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 80,
    wordWrap: 'nowrap',
    maxWidth: 85
  },
  notMeasuredText: {
    color: '#FF0000', // Red color for unmeasured dimensions
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendIcon: {
    width: 16,
    height: 16,
  },
  legendText: {
    fontSize: 14,
    color: Colors.secondaryText,
  },
  noteText: {
    fontSize: 14,
    color: Colors.secondaryText,
    textAlign: 'center',
  },
});