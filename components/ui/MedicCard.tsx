import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BaseText as Text } from '@/components/ui/Base';
import Colors from '@/constants/Colors';
import Gradients from '@/constants/Gradients';
import { MedicProfile } from '@/lib/services/ApiService';

interface MedicCardProps {
  medic: MedicProfile;
  onPress: (medic: MedicProfile) => void;
  loading?: boolean;
  disabled?: boolean;
  gradient?: boolean;
}

export default function MedicCard({ medic, onPress, loading = false, disabled = false, gradient = false }: MedicCardProps) {
  const isFreeChat = medic.one_on_one_price === 0;

  const medicCostStyle = {
    ...styles.medicCost,
    ...(isFreeChat ? styles.freeCost : styles.paidCost),
    ...(gradient ? styles.gradientCost : {}),
  };

  const cardContent = (
    <View style={styles.cardContent}>
        {/* Avatar on the left - tappable for score breakdown */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => onPress(medic)}
        >
          <Image
            source={{
              uri: medic.profile_picture_url || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png'
            }}
            style={styles.avatarCircle}
            defaultSource={{ uri: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png' }}
            onError={() => {
              // Fallback handled by defaultSource
            }}
          />
        </TouchableOpacity>

        {/* Content on the right */}
        <View style={styles.contentContainer}>
          {/* Top row: Medic name with cost */}
          <View style={styles.topRow}>
            <View style={styles.titleContainer}>
              <Text style={gradient ? styles.medicNameGradient : styles.medicName} numberOfLines={1}>
                {medic.raw_name}
              </Text>
              <Text style={medicCostStyle}>
                {medic.one_on_one_price === 0 ? '(Free)' : `(₹${medic.one_on_one_price}/month)`}
              </Text>
            </View>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.bottomTextContainer}>
              <Text style={gradient ? styles.matchTextGradient : styles.matchText}>
                {medic.match_emoji ? `${medic.match_emoji} ` : ''}{medic.match_percentage || 70}% Match
              </Text>
              <Text
                style={[gradient ? styles.medicCredentialsGradient : styles.medicCredentials, { marginTop: 8 }]}
              >
                {medic.designation}
              </Text>
              <Text style={gradient ? styles.medicCredentialsGradient : styles.medicCredentials}>{medic.years_of_experience} years exp</Text>
            </View>

            <TouchableOpacity
              style={[styles.chatButton, (loading || disabled) && styles.chatButtonDisabled]}
              onPress={() => onPress(medic)}
              disabled={loading || disabled}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.chatButtonText}>Chat</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
  );

  if (gradient) {
    return (
      <LinearGradient
        colors={Gradients.vibrant.colors as [string, string, ...string[]]}
        locations={Gradients.vibrant.locations}
        style={styles.medicCard}
      >
        {cardContent}
      </LinearGradient>
    );
  }

  return (
    <View style={styles.medicCard}>
      {cardContent}
    </View>
  );
}

const styles = StyleSheet.create({
  medicCard: {
    borderRadius: 16,
    marginBottom: 12,
    marginHorizontal: 8,
    overflow: 'hidden',
    backgroundColor: Colors.headerFooter
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  contentContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  medicName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.black,
    marginRight: 6,
  },
  medicNameGradient: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginRight: 6,
  },
  medicCost: {
    fontSize: 12,
    fontWeight: '400',
  },
  paidCost: {
    color: '#C2185B', // Dark pink for paid chats
  },
  freeCost: {
    color: '#F57C00', // Orange for free chats
  },
  medicCredentials: {
    fontSize: 13,
    color: '#333',
  },
  medicCredentialsGradient: {
    fontSize: 13,
    color: Colors.white,
  },
  experienceText: {
    fontSize: 11,
    color: '#666',
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  bottomTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '600',
  },
  matchTextGradient: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: '600',
  },
  gradientCost: {
    color: Colors.primary,
    fontWeight: '600',
  },
  chatButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 90,
    textAlign: 'center'
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center'
  },
  chatButtonDisabled: {
    opacity: 0.6,
  },
});
