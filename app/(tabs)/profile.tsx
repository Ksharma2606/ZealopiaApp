import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  TextInput,
  Share,
  Dimensions,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { BaseText as Text } from '@/components/ui/Base';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/lib/context/AuthContext';
import TopicsSelectionModal from '@/components/modals/TopicsSelectionModal';
import SoulProfileDisplay from '@/components/ui/SoulProfileDisplay';
import ApiService from '@/lib/services/ApiService';
import { useCreditStore } from '@/lib/services/CreditService';
import Colors from '@/constants/Colors';
import ArrowField from '@/components/ui/ArrowField';

const { width, height } = Dimensions.get('window');

interface Topic {
  id: number;
  name: string;
}

const ImageIcons = {
  CALL: require('@/assets/images/icons/call.png'),
  CAT: require('@/assets/images/icons/cat.png'),
  COINS: require('@/assets/images/icons/coins.png'),
  SHARE: require('@/assets/images/icons/share.png'),
  USER: require('@/assets/images/icons/user.png'),
  HEART: require('@/assets/images/icons/heart.png'),
  PENCIL: require('@/assets/images/icons/pencil.png'),
}

const ImageIcon = ({ name, size, color }: { name: keyof typeof ImageIcons, size: number, color?: string }) => {
  return <Image  source={ImageIcons[name]} style={{ width: size, height: size, tintColor: color || Colors.primaryText }} resizeMode='contain' />;
};

export default function ProfileTab() {
  const { firebaseUser, backendUser, signOut, updateUserProfile } = useAuthContext();
  const { creditBalance, redeemCoupon, fetchCreditDetails } = useCreditStore();
  const [isNameEditing, setIsNameEditing] = useState(false);
  const [topicsModalVisible, setTopicsModalVisible] = useState(false);
  const [userName, setUserName] = useState(backendUser?.user_profile?.name || 'User');
  const [userTopics, setUserTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [appInfoExpanded, setAppInfoExpanded] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Real values from backend user data
  const userCredits = creditBalance || backendUser?.user_profile?.credit_balance || 0;
  const referralCode = backendUser?.user_profile?.referral_code || 'LOADING...';
  const phoneNumber = backendUser?.mobile || firebaseUser?.phoneNumber || '';
  const userEmail = backendUser?.email || firebaseUser?.email || '';
  
  // Check if user is a medical professional
  const isMedicalProfessional = !!backendUser?.medical_profile;

  // Update userName when backendUser changes
  useEffect(() => {
    if (backendUser?.user_profile?.name) {
      setUserName(backendUser.user_profile.name);
    }
  }, [backendUser?.user_profile?.name]);

  // Load user topics and credits when component mounts
  useEffect(() => {
    loadUserTopics();
    fetchCreditDetails();
  }, []);

  const loadUserTopics = async () => {
    try {
      setLoadingTopics(true);
      const response = await ApiService.getUserTopics();
      
      if (response.success && response.data) {
        setUserTopics(response.data);
      }
    } catch (error) {
      console.error('Error loading user topics:', error);
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoggingOut(true);
              await signOut();
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            } finally {
              setIsLoggingOut(false);
            }
          }
        },
      ]
    );
  };

  const handleNameEdit = async () => {
    if (isNameEditing) {
      // Save changes to backend
      try {
        updateUserProfile({ name: userName });
        // TODO: Call API to save to backend
        console.log('Name updated to:', userName);
      } catch (error) {
        console.error('Error updating name:', error);
        Alert.alert('Error', 'Failed to update name. Please try again.');
      }
    }
    setIsNameEditing(!isNameEditing);
  };

  const handleTopicsEdit = () => {
    setTopicsModalVisible(true);
  };

  const handleTopicsSave = (selectedTopics: Topic[]) => {
    setUserTopics(selectedTopics);
  };

  const getTopicsDisplayText = () => {
    if (loadingTopics) {
      return 'Loading...';
    }
    
    if (userTopics.length === 0) {
      return 'Please select your interests';
    }
    
    if (userTopics.length <= 2) {
      return userTopics.map(topic => topic.name).join(', ');
    }
    
    return `${userTopics.slice(0, 2).map(topic => topic.name).join(', ')} +${userTopics.length - 2} more`;
  };

  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  const handleCouponCodeChange = (text: string) => {
    setCouponCode(text);
    // Clear messages when user starts typing
    if (couponError) setCouponError('');
    if (couponSuccess) setCouponSuccess('');
  };

  const handleApplyCoupon = async () => {
    try {
      if (!couponCode) return;

      // Clear previous messages
      setCouponError('');
      setCouponSuccess('');

      const result = await redeemCoupon(couponCode);

      if (result.success) {
        // Refresh credit details to show updated balance
        await fetchCreditDetails();
        setCouponCode('');
        setCouponSuccess('Coupon applied!');
      } else {
        setCouponError(result.message || 'Please try again');
      }
      
      return result;
    } catch (error) {
      console.error('Error applying coupon:', error);
      setCouponError('Please try again');
      return {
        success: false,
        message: 'Failed to apply coupon. Please try again.',
      };
    }
  };

  const handleShareReferral = async () => {
    try {
      await Share.share({
        message: `Join Zealopia using my referral code: ${referralCode}`,
        title: 'Join Zealopia',
      });
    } catch (error) {
      console.error('Error sharing referral code:', error);
    }
  };

  const handleCopyReferral = async () => {
    await Clipboard.setStringAsync(referralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard');
  };

  const handleMentalHealthRegister = () => {
    // TODO: Navigate to mental health professional registration
    Alert.alert('Coming Soon', 'Mental Health Professional registration will be available soon');
  };

  const handlePrivacyPolicy = async () => {
    try {
      await Linking.openURL('https://www.zealopia.com/privacy');
    } catch (error) {
      Alert.alert('Error', 'Could not open Privacy Policy');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await Linking.openURL('https://www.zealopia.com/deletion');
    } catch (error) {
      Alert.alert('Error', 'Could not open Delete Account page');
    }
  };

  return (
    <LinearGradient
      // TODO: Adjust gradient colors to match design exactly
      colors={['#F8E2EE', '#FDDFD7', '#FDDFD8']} // Green to purple gradient
      locations={[0.29, 0.49, 0.76]}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <Image 
              source={require('@/assets/images/zeal.png')}
              style={styles.avatarImage}
            />
          </View>
        </View>

        

        {/* Profile Info Fields - Individual white containers */}
        <View style={styles.fieldsContainer}>
          {/* Name Section */}
          <View style={styles.fieldRow}>
            <View style={[styles.iconContainer, { paddingTop: 12 }]}>
              <ImageIcon name="USER" size={24} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Name</Text>
              {isNameEditing ? (
                <TextInput
                  style={styles.editInput}
                  value={userName}
                  onChangeText={setUserName}
                  onBlur={handleNameEdit}
                  autoFocus
                />
              ) : (
                <View style={styles.fieldValueContainer}>
                  <Text style={styles.fieldValue}>{userName}</Text>
                </View>
              )}
            </View>
            {!isMedicalProfessional && (
              <TouchableOpacity onPress={handleNameEdit} style={styles.editButton}>
                <ImageIcon name="PENCIL" size={20} />
              </TouchableOpacity>
            )}
          </View>

          {/* Soul Profile Display */}
        {backendUser?.soul_profile && (
          <SoulProfileDisplay soulProfile={backendUser.soul_profile} />
        )}

          {/* Phone Number Section */}
          <View style={styles.fieldRow}>
            <View style={[styles.iconContainer, { paddingTop: 12 }]}>
              <ImageIcon name="CALL" size={24} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <View style={styles.fieldValueContainer}>
                <Text style={styles.fieldValue}>{phoneNumber}</Text>
              </View>
            </View>
          </View>

          {/* Topics Section */}
          <TouchableOpacity style={styles.fieldRow} onPress={handleTopicsEdit}>
            <View style={[styles.iconContainer, { paddingTop: 12 }]}>
              <ImageIcon name="HEART" size={24} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Your topics of interest</Text>
              <View style={styles.fieldValueContainer}>
                <Text style={[
                  styles.fieldValue, 
                  userTopics.length === 0 && !loadingTopics && styles.placeholderText
                ]}>
                  {getTopicsDisplayText()}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#999" style={styles.dropdownIcon} />
              </View>
            </View>
            <View style={styles.editButton}>
              <ImageIcon name="PENCIL" size={20} />
            </View>
          </TouchableOpacity>

          {/* Credits Section */}
          <View style={styles.creditsField}>
            <View style={styles.creditsRow}>
              <View style={styles.iconContainer}>
                <ImageIcon name="COINS" size={24} />
              </View>
              <View style={styles.creditsContent}>
                <Text style={styles.fieldLabel}>Zealopia Credits</Text>
                <View style={styles.creditsValueContainer}>
                  <Text style={styles.creditsValue}>{userCredits} ZC</Text>
                </View>
                <Text style={styles.creditsRate}>1 ZC = 1 ₹</Text>
              </View>
              <ArrowField
                onPress={handleApplyCoupon}
                value={couponCode}
                onChangeText={handleCouponCodeChange}
                placeholder="Add Coupon"
                onSubmitEditing={() => {}}
                arrowSize={36}
                containerStyle={{
                  backgroundColor: Colors.otpBackground,
                  marginLeft: 6,
                  elevation: 2,
                  shadowColor: Colors.primaryText,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3,
                  height: 36,
                }}
                inputStyle={{
                  color: Colors.primaryText,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  fontSize: 12,
                  minWidth: '30%'
                }}
                placeholderTextColor={Colors.secondaryText}
                error={couponError}
                success={couponSuccess}
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        {/* Referral Section - Separate container */}
        <View style={styles.referralContainer}>
          <Text style={styles.referralTitle}>Refer and earn 100 ZC when they join a paid group</Text>
          <View style={styles.referralRow}>
            <View style={styles.iconContainer}>
              <ImageIcon name="CAT" size={24} />
            </View>
            <View style={styles.referralCodeField}>
              <Text style={styles.referralCode}>{referralCode}</Text>
            </View>
            <TouchableOpacity onPress={handleShareReferral} style={styles.shareButton}>
              <ImageIcon name="SHARE" size={20} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
          onPress={handleSignOut}
          disabled={isLoggingOut}
        >
          <Text style={styles.logoutText}>
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </Text>
        </TouchableOpacity>

        {/* Mental Health Professional Registration */}
        <TouchableOpacity onPress={handleMentalHealthRegister} style={styles.mentalHealthButton}>
          <Text style={styles.mentalHealthText}>Register as a Mental Health Professional</Text>
        </TouchableOpacity>

        {/* App Information Section */}
        <View style={styles.appInfoContainer}>
          <TouchableOpacity 
            style={styles.appInfoHeader}
            onPress={() => setAppInfoExpanded(!appInfoExpanded)}
          >
            <Text style={styles.appInfoTitle}>App Information</Text>
            <Ionicons 
              name={appInfoExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#7B68EE" 
            />
          </TouchableOpacity>
          
          {appInfoExpanded && (
            <View style={styles.appInfoContent}>
              <TouchableOpacity style={styles.appInfoLink} onPress={handlePrivacyPolicy}>
                <Text style={styles.appInfoLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.appInfoLink} onPress={handleDeleteAccount}>
                <Text style={styles.appInfoLinkText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        
      </ScrollView>

      {/* Topics Selection Modal */}
      <TopicsSelectionModal
        visible={topicsModalVisible}
        onClose={() => setTopicsModalVisible(false)}
        onSave={handleTopicsSave}
        currentTopics={userTopics}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 2,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 5,
  },
  avatarContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: width * 0.35,
    height: width * 0.35,
    borderRadius: width * 0.15,
    resizeMode: 'contain',
  },
  fieldsContainer: {
    marginBottom: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  fieldContent: {
    flex: 1,
    alignContent: 'flex-end'
  },
  fieldLabel: {
    fontSize: 12,
    lineHeight: 15,
    color: Colors.primaryText,
    marginLeft: 4
  },
  fieldValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  fieldValue: {
    fontSize: 12,
    color: Colors.secondaryText,
    flex: 1,
  },
  placeholderText: {
    color: '#999',
    fontStyle: 'italic',
  },
  dropdownIcon: {
    marginLeft: 8,
  },
  editInput: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    borderBottomWidth: 1,
    borderBottomColor: '#7B68EE',
    paddingVertical: 4,
  },
  editButton: {
    padding: 8,
    paddingTop: 18
  },
  creditsField: {
    borderRadius: 15,
    paddingHorizontal: 15,
    // marginBottom: 12,
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  creditsContent: {
    flex: 1,
  },
  creditsValueContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
    height: 36,
  },
  creditsValue: {
    fontSize: 12,
    color: Colors.secondaryText,
    fontWeight: '600',
  },
  creditsRate: {
    fontSize: 12,
    marginTop: 2,
    color: Colors.primaryText,
    textAlign: 'right',
  },
  zealopiaIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  referralContainer: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
  },
  referralTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#333',
    marginBottom: 12,
    lineHeight: 20,
  },
  referralRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  referralCodeField: {
    borderRadius: 8,
    // paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 10,
    backgroundColor: 'white',
    paddingHorizontal: 12,
  },
  referralCode: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondaryText,
  },
  catIcon: {
    fontSize: 20,
  },
  shareButton: {
    padding: 8,
  },
  logoutButton: {
    backgroundColor: 'rgba(106, 106, 106, 0.7)',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
    marginHorizontal: 20,
    width: width * 0.5,
    alignSelf: 'center'
  },
  logoutButtonDisabled: {
    backgroundColor: 'rgba(106, 106, 106, 0.4)',
    opacity: 0.6,
  },
  logoutText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '500',
  },
  mentalHealthButton: {
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  mentalHealthText: {
    color: '#7B68EE',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  appInfoContainer: {
    marginBottom: 20,
    marginHorizontal: 20,
  },
  appInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 0,
    padding: 16,
  },
  appInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  appInfoContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  appInfoLink: {
    paddingVertical: 8,
  },
  appInfoLinkText: {
    fontSize: 14,
    color: '#7B68EE',
    textDecorationLine: 'underline',
  },
});