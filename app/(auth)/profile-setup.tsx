import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Dropdown } from 'react-native-element-dropdown';
import apiService from '@/lib/services/ApiService';
import { useAuth } from '@/lib/context/AuthContext';
import { auth } from '@/lib/firebase';
import { useCreditStore } from '@/lib/services/CreditService';
import ArrowField from '@/components/ui/ArrowField';
import { LinearGradient } from 'expo-linear-gradient';
import Gradients from '@/constants/Gradients';
import Colors from '@/constants/Colors';
import LogoHeader from '@/components/LogoHeader';
import { BaseText as Text } from '@/components/ui/Base';

const { width: screenWidth } = Dimensions.get('window');

const pronounsData = [
  { label: 'He/Him', value: 'He/Him' },
  { label: 'She/Her', value: 'She/Her' },
  { label: 'They/Them', value: 'They/Them' },
  { label: 'Other', value: 'Other' },
];

const orientationData = [
  { label: 'LGBTQ+', value: 'LGBTQ+' },
  { label: 'Straight', value: 'Straight' },
  { label: 'Prefer not to say', value: 'Prefer not to say' },
];

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { backendUser, updateUserProfile, refreshUserData } = useAuth();
  const { redeemCoupon, fetchCreditDetails } = useCreditStore();
  
  // Form state - initialize with existing user data if available
  const [name, setName] = useState(backendUser?.user_profile?.name || '');
  const [birthYear, setBirthYear] = useState(
    backendUser?.user_profile?.birth_year?.toString() || ''
  );
  const [pronouns, setPronouns] = useState(backendUser?.user_profile?.pronouns || '');
  const [orientation, setOrientation] = useState(backendUser?.user_profile?.orientation || '');
  const [referralCode, setReferralCode] = useState('');
  const [corporateCode, setCorporateCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ birthYear: '', general: '' });
  const [referralStatus, setReferralStatus] = useState<'none' | 'success' | 'error'>('none');
  const [corporateStatus, setCorporateStatus] = useState<'none' | 'success' | 'error'>('none');
  const [referralMessage, setReferralMessage] = useState('');
  const [corporateMessage, setCorporateMessage] = useState('');

  // Validation
  const validateBirthYear = (year: string) => {
    const currentYear = new Date().getFullYear();
    const numYear = parseInt(year);
    
    if (isNaN(numYear)) {
      return 'Please enter a valid year';
    }
    if (numYear < 1945) {
      return 'Birth Year should be at least 1945';
    }
    if (numYear > currentYear - 12) {
      return 'Should be at least 12 years old';
    }
    return '';
  };

  const handleBirthYearChange = (year: string) => {
    // Only allow 4 digits
    const numericYear = year.replace(/[^0-9]/g, '');
    if (numericYear.length <= 4) {
      setBirthYear(numericYear);
      
      // Validate after typing
      if (numericYear.length === 4) {
        const error = validateBirthYear(numericYear);
        setErrors(prev => ({ ...prev, birthYear: error }));
      } else {
        setErrors(prev => ({ ...prev, birthYear: '' }));
      }
    }
  };

  const errorTimeout = 20000;

  const handleReferralCode = async () => {
    if (!referralCode.trim()) {
      setReferralStatus('error');
      setReferralMessage('Please enter a referral code');
      return;
    }
    
    try {
      // Referral codes should be redeemed with isReferral = true
      const result = await redeemCoupon(referralCode.trim(), true);
      
      if (result.success) {
        setReferralStatus('success');
        setReferralMessage(result.message || '100 credits added!');
        setReferralCode(''); // Clear the input on success
        
        // Refresh credit details to get updated balance
        await fetchCreditDetails();
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setReferralStatus('none');
          setReferralMessage('');
        }, errorTimeout);
      } else {
        setReferralStatus('error');
        setReferralMessage(result.message || 'Invalid code');
        
        // Clear error message after 3 seconds
        setTimeout(() => {
          setReferralStatus('none');
          setReferralMessage('');
        }, errorTimeout);
      }
    } catch (error) {
      console.error('Error redeeming referral code:', error);
      setReferralStatus('error');
      setReferralMessage('Invalid code');
      
      // Clear error message after 3 seconds
      setTimeout(() => {
        setReferralStatus('none');
        setReferralMessage('');
      }, errorTimeout);
    }
  };

  const handleCorporateCode = async () => {
    if (!corporateCode.trim()) {
      setCorporateStatus('error');
      setCorporateMessage('Enter a code');
      return;
    }
    
    try {
      // Corporate codes are regular coupons, so isReferral = false
      const result = await redeemCoupon(corporateCode.trim(), false);
      
      if (result.success) {
        setCorporateStatus('success');
        setCorporateMessage(result.message || '100 credits added!');
        setCorporateCode(''); // Clear the input on success
        
        // Refresh credit details to get updated balance
        await fetchCreditDetails();
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setCorporateStatus('none');
          setCorporateMessage('');
        }, errorTimeout);
      } else {
        setCorporateStatus('error');
        setCorporateMessage(result.message || 'Invalid code');
        
        // Clear error message after 3 seconds
        setTimeout(() => {
          setCorporateStatus('none');
          setCorporateMessage('');
        }, errorTimeout);
      }
    } catch (error) {
      console.error('Error redeeming corporate code:', error);
      setCorporateStatus('error');
      setCorporateMessage('Invalid code');
      
      // Clear error message after 3 seconds
      setTimeout(() => {
        setCorporateStatus('none');
        setCorporateMessage('');
      }, errorTimeout);
    }
  };

  const handleSubmit = async () => {
    // Validate form
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter your name');
      return;
    }
    
    if (!birthYear) {
      Alert.alert('Validation Error', 'Please enter your birth year');
      return;
    }
    
    const yearError = validateBirthYear(birthYear);
    if (yearError) {
      setErrors(prev => ({ ...prev, birthYear: yearError }));
      return;
    }
    
    if (!pronouns) {
      Alert.alert('Validation Error', 'Please select your pronouns');
      return;
    }

    if (!orientation) {
      Alert.alert('Validation Error', 'Please select your sexual orientation');
      return;
    }

    setLoading(true);
    setErrors(prev => ({ ...prev, general: '' }));
    
    try {
      // Make API call to update user profile
      const response = await apiService.updateUserProfile({
        name: name.trim(),
        birth_year: birthYear,
        pronouns,
        orientation,
      });

      if (response.success) {
        console.log('Profile updated successfully:', response.data);
        
        // Update user profile in context with the new data
        console.log('Updating user profile context with name:', name.trim());
        updateUserProfile({
          name: name.trim(),
        });
        
        // Refresh user data to get latest backend state including soul_bot_group_uid
        console.log('Refreshing user data after profile setup...');
        await refreshUserData();
        
        // Navigate to Zora introduction screen
        console.log('Profile setup complete, navigating to Zora intro screen');
        
        // Small delay to ensure state updates properly
        setTimeout(() => {
          console.log('Executing navigation to Zora intro screen');
          router.replace('/(auth)/zora-intro');
        }, 100);
      } else {
        setErrors(prev => ({ 
          ...prev, 
          general: response.error || 'Failed to update profile. Please try again.' 
        }));
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setErrors(prev => ({ 
        ...prev, 
        general: 'Network error. Please check your connection and try again.' 
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={Gradients.choosingTopic.colors}
      locations={Gradients.choosingTopic.locations}
      style={styles.gradient}
    >
    <SafeAreaView style={styles.container}>
      <View style={styles.topOval}></View>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <LogoHeader />

            {/* Content Section */}
            <View style={styles.contentContainer}>
              <Text style={styles.title}>What should we call you?</Text>

              {/* Name Input */}
              <View style={styles.inputWrapper}>
                <Ionicons name="person" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="You may choose any name"
                  placeholderTextColor="#999"
                />
              </View>

              {/* Birth Year and Pronouns Row */}
              <View style={styles.rowContainer}>
                <View style={styles.halfInputWrapper}>
                  <TextInput
                    style={[styles.textInput, styles.halfInput]}
                    value={birthYear}
                    onChangeText={handleBirthYearChange}
                    placeholder="Birth year"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>

                <View style={styles.halfInputWrapper}>
                  <Dropdown
                    data={pronounsData}
                    labelField="label"
                    valueField="value"
                    placeholder="Pronouns"
                    value={pronouns}
                    onChange={(item) => setPronouns(item.value)}
                    style={styles.dropdown}
                    placeholderStyle={styles.dropdownPlaceholder}
                    selectedTextStyle={styles.dropdownSelectedText}
                    containerStyle={styles.dropdownContainer}
                    itemTextStyle={styles.dropdownItemText}
                  />
                </View>
              </View>

              {/* Orientation Dropdown */}
              <View style={styles.fullInputWrapper}>
                <Dropdown
                  data={orientationData}
                  labelField="label"
                  valueField="value"
                  placeholder="Sexual Orientation (for therapist matching)"
                  value={orientation}
                  onChange={(item) => setOrientation(item.value)}
                  style={styles.dropdown}
                  placeholderStyle={styles.dropdownPlaceholder}
                  selectedTextStyle={styles.dropdownSelectedText}
                  containerStyle={styles.dropdownContainer}
                  itemTextStyle={styles.dropdownItemText}
                />
              </View>

              {/* Error Display */}
              {(errors.birthYear || errors.general) && (
                <Text style={styles.errorText}>
                  {errors.birthYear || errors.general}
                </Text>
              )}

              <View style={styles.codeFieldContainerGroup}>
                <View style={styles.codeFieldContainer}>
                  <ArrowField
                    onPress={handleReferralCode}
                    value={referralCode}
                    onChangeText={setReferralCode}
                    placeholder="ADD REFERRAL CODE"
                    onSubmitEditing={handleReferralCode}
                    autoCapitalize="characters"
                  />
                  <Text style={[styles.codeFieldMessage, referralStatus === 'success' && styles.successMessage]}>
                    {referralStatus === 'success' ? referralMessage : ''}
                  </Text>
                </View>
                <Text style={[styles.codeFieldMessage, styles.codeFieldMessageError]}>
                  {referralStatus === 'error' ? referralMessage : ''}
                </Text>
              </View>

              <View style={styles.codeFieldContainerGroup}>
                <View style={styles.codeFieldContainer}>
                  <ArrowField
                    onPress={handleCorporateCode}
                    value={corporateCode}
                    onChangeText={setCorporateCode}
                    placeholder="ADD CORPORATE CODE"
                    onSubmitEditing={handleCorporateCode}
                    autoCapitalize="characters"
                  />
                  <Text style={[styles.codeFieldMessage, corporateStatus === 'success' && styles.successMessage]}>
                    {corporateStatus === 'success' ? corporateMessage : ''}
                  </Text>
                </View>
                <Text style={[styles.codeFieldMessage, styles.codeFieldMessageError]}>
                  {corporateStatus === 'error' ? corporateMessage : ''}
                </Text>
              </View>

              <Text style={styles.creditInfo}>
                You can check your credit balance in the{'\n'}
                'You' section on the homepage
              </Text>

              {/* Proceed Button */}
              <TouchableOpacity
                style={[styles.proceedButton, loading && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text style={styles.proceedButtonText}>
                  {loading ? 'Updating...' : 'Proceed'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    zIndex: 2,
  },
  topOval: {
    backgroundColor: '#6F62B1',
    width: screenWidth * 1.2,
    height: screenWidth * 1.2,
    borderRadius: screenWidth * 1.2,
    position: 'absolute',
    top: -screenWidth * 0.55,
    left: -screenWidth * 0.1,
    zIndex: 1,
  },
  gradient: {
    minHeight: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  contentContainer: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F163D',
    textAlign: 'center',
    marginBottom: 40,
  },
  inputWrapper: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 4,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
  },
  rowContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  halfInputWrapper: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  fullInputWrapper: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  halfInput: {
    paddingVertical: 14,
  },
  dropdown: {
    color: '#333',
    paddingVertical: 14,
    paddingHorizontal: 0,
  },
  dropdownPlaceholder: {
    color: '#999',
    fontSize: 16,
  },
  dropdownSelectedText: {
    color: '#333',
    fontSize: 16,
  },
  dropdownContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownItemText: {
    color: '#333',
    fontSize: 16,
    paddingVertical: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  codeFieldContainerGroup: {
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  codeFieldContainer: {
    width: screenWidth * 0.6,
  },
  codeFieldMessage: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '600'
  },
  codeFieldMessageError: {
    width: screenWidth * 0.35,
    color: Colors.primary,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  successMessage: {
    color: '#10B981',
  },
  errorMessage: {
    color: '#EF4444',
  },
  creditInfo: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 20,
    lineHeight: 20,
  },
  proceedButton: {
    backgroundColor: '#DD7896',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 60,
    alignSelf: 'center',
  },
  disabledButton: {
    backgroundColor: '#F8BBD0',
  },
  proceedButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
