import React, { useState, useEffect } from 'react';
import {
  View,
  // Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Image,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/context/AuthContext';
import ApiService from '@/lib/services/ApiService';
import { Picker } from '@react-native-picker/picker';
import { BaseText as Text } from '@/components/ui/Base';

interface Topic {
  id: number;
  name: string;
}

interface UserProfileData {
  name?: string;
  mobile?: string;
  credit_balance?: number;
  referral_code?: string;
  selected_topics?: number[];
}

export default function UserProfileScreen() {
  const { firebaseUser, backendUser, signOut, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Profile data
  const [profileData, setProfileData] = useState<UserProfileData>({});
  const [profilePicture, setProfilePicture] = useState<string>('');
  
  // Editable states
  const [isNameEditable, setIsNameEditable] = useState(false);
  const [isTopicsEditable, setIsTopicsEditable] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  
  // Topics data
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  
  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [couponSuccess, setCouponSuccess] = useState(false);
  
  // Expandable sections
  const [showAppInfo, setShowAppInfo] = useState(false);
  
  // Check if user is medic
  const isMedic = backendUser?.medical_profile?.id ? true : false;
  const canEditName = !isMedic; // Medics cannot edit name

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load user profile data
      await refreshUserData();
      
      // Load topics
      const topicsResponse = await ApiService.getTopics();
      if (topicsResponse.success && topicsResponse.data) {
        setAllTopics(topicsResponse.data);
      }
      
      // Load user's selected topics
      const userTopicsResponse = await ApiService.getUserTopics();
      if (userTopicsResponse.success && userTopicsResponse.data) {
        const topicIds = userTopicsResponse.data.map((t: Topic) => t.id);
        setSelectedTopics(topicIds);
      }
      
      // Set initial values
      if (backendUser) {
        setNameValue(backendUser.user_profile?.name || '');
        setProfileData({
          name: backendUser.user_profile?.name,
          mobile: backendUser.mobile || firebaseUser?.phoneNumber,
          credit_balance: backendUser.user_profile?.credit_balance || 0,
          referral_code: backendUser.user_profile?.referral_code || '',
        });
        
        if (isMedic && backendUser.medical_profile?.profile_picture) {
          setProfilePicture(backendUser.medical_profile.profile_picture);
        }
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      if (isNameEditable && nameValue !== profileData.name) {
        const response = await ApiService.updateUserProfile({ name: nameValue });
        if (response.success) {
          setProfileData(prev => ({ ...prev, name: nameValue }));
          setIsNameEditable(false);
        } else {
          Alert.alert('Error', 'Failed to update name');
          return;
        }
      }
      
      if (isTopicsEditable) {
        const response = await ApiService.updateUserTopics(selectedTopics);
        if (response.success) {
          setIsTopicsEditable(false);
        } else {
          Alert.alert('Error', 'Failed to update topics');
          return;
        }
      }
      
      await refreshUserData();
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePicture = async () => {
    if (!isMedic) return;
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to update your profile picture');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    
    if (!result.canceled && result.assets[0]) {
      try {
        setSaving(true);
        const response = await ApiService.updateMedicProfilePicture(result.assets[0]);
        if (response.success) {
          setProfilePicture(result.assets[0].uri);
          Alert.alert('Success', 'Profile picture updated');
        } else {
          Alert.alert('Error', 'Failed to update profile picture');
        }
      } catch (error) {
        console.error('Error updating profile picture:', error);
        Alert.alert('Error', 'Failed to update profile picture');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) {
      Alert.alert('Error', 'Enter a code');
      return;
    }
    
    try {
      const response = await ApiService.redeemCoupon(couponCode.trim());
      if (response.success) {
        setCouponSuccess(true);
        setCouponMessage(response.data?.message || 'Coupon redeemed successfully');
        setCouponCode('');
        await refreshUserData();
        setTimeout(() => setCouponMessage(''), 3000);
      } else {
        setCouponSuccess(false);
        setCouponMessage(response.error || 'Invalid coupon code');
        setTimeout(() => setCouponMessage(''), 3000);
      }
    } catch (error) {
      setCouponSuccess(false);
      setCouponMessage('Failed to redeem coupon');
      setTimeout(() => setCouponMessage(''), 3000);
    }
  };

  const handleShareReferral = async () => {
    try {
      await Share.share({
        message: `Get an instant ₹ 100 voucher to use on any exclusive group on Zealopia's anonymous group chats. To redeem the voucher, please install the app and enter this referral code (${profileData.referral_code}) while signing up. Hurry! reward expires soon! 😀 Happy Happiness to you.`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/splash');
          }
        },
      ]
    );
  };

  const renderTopicSelector = () => {
    if (Platform.OS === 'ios') {
      return (
        <>
          <TouchableOpacity
            style={[styles.input, !isTopicsEditable && styles.inputDisabled]}
            onPress={() => isTopicsEditable && setShowTopicPicker(true)}
          >
            <Text style={[styles.inputText, !isTopicsEditable && styles.inputTextDisabled]}>
              {selectedTopics.length > 0 
                ? `${selectedTopics.length} topics selected`
                : 'Select topics...'}
            </Text>
          </TouchableOpacity>
          
          {showTopicPicker && (
            <View style={styles.pickerModal}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowTopicPicker(false)}>
                  <Text style={styles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.topicList}>
                {allTopics.map((topic) => (
                  <TouchableOpacity
                    key={topic.id}
                    style={styles.topicItem}
                    onPress={() => {
                      if (selectedTopics.includes(topic.id)) {
                        setSelectedTopics(prev => prev.filter(id => id !== topic.id));
                      } else {
                        setSelectedTopics(prev => [...prev, topic.id]);
                      }
                    }}
                  >
                    <Text style={styles.topicText}>{topic.name}</Text>
                    {selectedTopics.includes(topic.id) && (
                      <Ionicons name="checkmark" size={20} color="#FFD700" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </>
      );
    }
    
    // Android multi-select workaround
    return (
      <View style={[styles.input, !isTopicsEditable && styles.inputDisabled]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {allTopics.map((topic) => (
            <TouchableOpacity
              key={topic.id}
              style={[
                styles.topicChip,
                selectedTopics.includes(topic.id) && styles.topicChipSelected
              ]}
              onPress={() => {
                if (!isTopicsEditable) return;
                if (selectedTopics.includes(topic.id)) {
                  setSelectedTopics(prev => prev.filter(id => id !== topic.id));
                } else {
                  setSelectedTopics(prev => [...prev, topic.id]);
                }
              }}
              disabled={!isTopicsEditable}
            >
              <Text style={[
                styles.topicChipText,
                selectedTopics.includes(topic.id) && styles.topicChipTextSelected
              ]}>
                {topic.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#78B3AC', '#95CABC', '#FFFFFF']}
          locations={[0, 0.5365, 0.7865]}
          style={styles.gradient}
        >
          <View style={styles.content}>
            {/* Profile Picture */}
            <View style={styles.profilePictureContainer}>
              <TouchableOpacity
                onPress={handleProfilePicture}
                disabled={!isMedic}
                style={styles.profilePictureWrapper}
              >
                {profilePicture ? (
                  <Image source={{ uri: profilePicture }} style={styles.profilePicture} />
                ) : (
                  <View style={styles.profilePicturePlaceholder}>
                    <Ionicons name="person" size={60} color="#666" />
                  </View>
                )}
                {isMedic && (
                  <View style={styles.editIconContainer}>
                    <Ionicons name="pencil" size={20} color="#FFD700" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Name Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="person" size={24} color="#333" />
                <Text style={styles.sectionTitle}>Name</Text>
                {canEditName && !isNameEditable && (
                  <TouchableOpacity onPress={() => setIsNameEditable(true)}>
                    <Ionicons name="pencil" size={20} color="#FFD700" />
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[styles.input, !isNameEditable && styles.inputDisabled]}
                value={nameValue}
                onChangeText={setNameValue}
                editable={isNameEditable}
                placeholder="Enter your name"
              />
            </View>

            {/* Phone Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="call" size={24} color="#333" />
                <Text style={styles.sectionTitle}>Phone Number</Text>
              </View>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={profileData.mobile || ''}
                editable={false}
              />
            </View>

            {/* Topics Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="heart-outline" size={24} color="#333" />
                <Text style={styles.sectionTitle}>Your topics of interest</Text>
                {!isTopicsEditable && (
                  <TouchableOpacity onPress={() => setIsTopicsEditable(true)}>
                    <Ionicons name="pencil" size={20} color="#FFD700" />
                  </TouchableOpacity>
                )}
              </View>
              {renderTopicSelector()}
            </View>

            {/* Credits Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.creditsIcon}>ZC</Text>
                <Text style={styles.sectionTitle}>Zealopia Credits</Text>
              </View>
              <View style={styles.creditsContainer}>
                <View style={styles.creditBalance}>
                  <Text style={styles.creditAmount}>{profileData.credit_balance || 0}</Text>
                  <Text style={styles.creditLabel}>ZC</Text>
                </View>
                <Text style={styles.creditInfo}>1 ZC = ₹1</Text>
              </View>
              
              <View style={styles.couponContainer}>
                <TextInput
                  style={styles.couponInput}
                  value={couponCode}
                  onChangeText={setCouponCode}
                  placeholder="Enter coupon code"
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={styles.couponButton} onPress={handleRedeemCoupon}>
                  <Text style={styles.couponButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
              
              {couponMessage ? (
                <Text style={[styles.couponMessage, couponSuccess ? styles.successMessage : styles.errorMessage]}>
                  {couponMessage}
                </Text>
              ) : null}
            </View>

            {/* Referral Section */}
            <View style={styles.section}>
              <Text style={styles.referralTitle}>
                Refer and earn 100 ZC when they join a paid group
              </Text>
              <View style={styles.referralContainer}>
                <Ionicons name="gift" size={24} color="#333" />
                <View style={styles.referralCode}>
                  <Text style={styles.referralCodeText}>{profileData.referral_code}</Text>
                </View>
                <TouchableOpacity onPress={handleShareReferral}>
                  <Ionicons name="share-social" size={24} color="#333" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Save Button */}
            {(isNameEditable || isTopicsEditable) && (
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Action Buttons */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>

            {isMedic ? (
              <TouchableOpacity 
                style={styles.earningsButton}
                onPress={() => router.push('/medic-earnings')}
              >
                <Text style={styles.earningsButtonText}>My Earnings</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => Alert.alert('Coming Soon', 'Medic registration will be available soon')}>
                <Text style={styles.medicRegisterText}>
                  Register as a Mental Health Professional
                </Text>
              </TouchableOpacity>
            )}

            {/* App Information */}
            <TouchableOpacity
              style={styles.expandableHeader}
              onPress={() => setShowAppInfo(!showAppInfo)}
            >
              <Text style={styles.expandableTitle}>App Information</Text>
              <Ionicons 
                name={showAppInfo ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#333" 
              />
            </TouchableOpacity>
            
            {showAppInfo && (
              <View style={styles.appInfoContent}>
                <TouchableOpacity onPress={() => Alert.alert('Privacy Policy', 'Opening privacy policy...')}>
                  <Text style={styles.linkText}>Privacy Policy</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Alert.alert('Delete Account', 'Account deletion request...')}>
                  <Text style={styles.linkText}>Delete Account</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    minHeight: '100%',
  },
  content: {
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 80,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profilePictureWrapper: {
    position: 'relative',
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 60,
  },
  profilePicturePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  inputText: {
    fontSize: 14,
    color: '#333',
  },
  inputTextDisabled: {
    color: '#666',
  },
  creditsIcon: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  creditsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  creditBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  creditAmount: {
    fontSize: 16,
    color: '#666',
  },
  creditLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  creditInfo: {
    fontSize: 14,
    color: '#333',
  },
  couponContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  couponInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  couponButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  couponButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  couponMessage: {
    fontSize: 12,
    marginTop: 5,
  },
  successMessage: {
    color: '#4CAF50',
  },
  errorMessage: {
    color: '#F44336',
  },
  referralTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
    color: '#333',
  },
  referralContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  referralCode: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  referralCodeText: {
    fontSize: 14,
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#FFD700',
    borderRadius: 28,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  logoutButton: {
    backgroundColor: '#666',
    borderRadius: 28,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  earningsButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 28,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  earningsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  medicRegisterText: {
    fontSize: 16,
    color: '#FFD700',
    textAlign: 'center',
    marginTop: 20,
    textDecorationLine: 'underline',
  },
  expandableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: 20,
  },
  expandableTitle: {
    fontSize: 16,
    color: '#333',
  },
  appInfoContent: {
    paddingLeft: 10,
    gap: 10,
  },
  linkText: {
    fontSize: 16,
    color: '#FFD700',
    textDecorationLine: 'underline',
    paddingVertical: 5,
  },
  pickerModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: 300,
    zIndex: 1000,
  },
  pickerHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  pickerDone: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
  },
  topicList: {
    padding: 16,
  },
  topicItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  topicText: {
    fontSize: 16,
    color: '#333',
  },
  topicChip: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  topicChipSelected: {
    backgroundColor: '#FFD700',
  },
  topicChipText: {
    fontSize: 14,
    color: '#666',
  },
  topicChipTextSelected: {
    color: '#000',
    fontWeight: '500',
  },
});