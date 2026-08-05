import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/context/AuthContext';
import ApiService from '@/lib/services/ApiService';
import { BaseText as Text } from '@/components/ui/Base';
import Colors from '@/constants/Colors';

export interface Topic {
  id: number;
  name: string;
}

export default function CreateGroupScreen() {
  const { backendUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  
  // Form state
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState<1 | 2>(2); // 1 = 30 days, 2 = 60 days
  const [selectedTopic, setSelectedTopic] = useState<number | null>(null);
  
  // Validation state
  const [errors, setErrors] = useState({
    groupName: '',
    description: '',
    price: '',
    topic: '',
  });
  
  // Commission calculation
  const medicCommission = backendUser?.medical_profile?.percentage_commission || 20;
  const userShare = price ? Math.floor(((100 - medicCommission) / 100) * parseInt(price)) : 0;
  
  useEffect(() => {
    fetchTopics();
  }, []);
  
  const fetchTopics = async () => {
    try {
      const response = await ApiService.getTopics();
      if (response.success && response.data) {
        setTopics(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch topics:', error);
    } finally {
      setLoadingTopics(false);
    }
  };
  
  const validateForm = (): boolean => {
    const newErrors = {
      groupName: '',
      description: '',
      price: '',
      topic: '',
    };
    
    let isValid = true;
    
    // Group name validation
    if (!groupName.trim()) {
      newErrors.groupName = 'Group name is required';
      isValid = false;
    }
    
    // Description validation
    if (!description.trim()) {
      newErrors.description = 'Description is required';
      isValid = false;
    }
    
    // Price validation
    const priceNum = parseInt(price);
    if (!price.trim()) {
      newErrors.price = 'Price is required';
      isValid = false;
    } else if (isNaN(priceNum) || priceNum < 150 || priceNum > 1000) {
      newErrors.price = 'Price must be between ₹150 and ₹1000';
      isValid = false;
    }
    
    // Topic validation
    if (!selectedTopic) {
      newErrors.topic = 'Topic selection is required';
      isValid = false;
    }
    
    setErrors(newErrors);
    return isValid;
  };
  
  const handleCreateGroup = async () => {
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await ApiService.createGroupTemplate({
        name: groupName.trim(),
        description: description.trim(),
        topic: selectedTopic!,
        cost: parseInt(price),
        expiry_months: duration,
      });
      
      if (response.success) {
        Alert.alert(
          'Success',
          'Group created successfully!',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(tabs)/chat'),
            },
          ]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to create group');
      }
    } catch (error) {
      console.error('Create group error:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={{
        backgroundColor: Colors.headerFooter,
        paddingTop: Platform.OS === 'ios' ? 80 : 60,
        paddingBottom: 15,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={30} color={Colors.white} />
        </TouchableOpacity>
        <Text style={{
          color: 'white',
          fontSize: 20,
          fontWeight: '600',
          marginLeft: 12,
        }}>
          Create a new Group
        </Text>
      </View>
      
      <ScrollView style={{ flex: 1, padding: 26 }}>
        {/* Group Name */}
        <View style={{ marginBottom: 15 }}>
          <Text style={{
            fontSize: 16,
            color: '#666',
            marginBottom: 8,
            fontFamily: 'Poppins',
          }}>
            Group Name
          </Text>
          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Type Name Here"
            placeholderTextColor={Colors.secondaryText}
            style={{
              borderWidth: 2,
              borderColor: errors.groupName ? Colors.headerFooter : '#ddd',
              borderRadius: 5,
              padding: 12,
              backgroundColor: '#f8f9fa',
              fontSize: 14,
              fontFamily: 'Poppins',
            }}
          />
          {errors.groupName ? (
            <Text style={{ color: Colors.headerFooter, fontSize: 12, marginTop: 4 }}>
              {errors.groupName}
            </Text>
          ) : null}
        </View>
        
        {/* Description */}
        <View style={{ marginBottom: 15 }}>
          <Text style={{
            fontSize: 16,
            color: '#666',
            marginBottom: 8,
            fontFamily: 'Poppins',
          }}>
            About the Group
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Mention who should join this group and what is the purpose of this group. Example- This group is for anyone who has gone through heart break and want to feel supported to get over it. Our intent is to help each other, share, stories and resources to heal better"
            placeholderTextColor={Colors.secondaryText}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            style={{
              borderWidth: 2,
              borderColor: errors.description ? Colors.headerFooter : '#ddd',
              borderRadius: 5,
              padding: 12,
              backgroundColor: '#f8f9fa',
              fontSize: 14,
              fontFamily: 'Poppins',
              minHeight: 120,
            }}
          />
          {errors.description ? (
            <Text style={{ color: Colors.headerFooter, fontSize: 12, marginTop: 4 }}>
              {errors.description}
            </Text>
          ) : null}
        </View>
        
        {/* Price */}
        <View style={{ marginBottom: 15 }}>
          <Text style={{
            fontSize: 16,
            color: '#666',
            marginBottom: 8,
            fontFamily: 'Poppins',
          }}>
            Set Group Price (₹150- ₹1000)
          </Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="Set your price"
            placeholderTextColor={Colors.secondaryText}
            keyboardType="numeric"
            style={{
              borderWidth: 2,
              borderColor: errors.price ? Colors.headerFooter : '#ddd',
              borderRadius: 5,
              padding: 12,
              backgroundColor: '#f8f9fa',
              fontSize: 14,
              fontFamily: 'Poppins',
              width: 176,
            }}
          />
          {errors.price ? (
            <Text style={{ color: Colors.headerFooter, fontSize: 12, marginTop: 4 }}>
              {errors.price}
            </Text>
          ) : null}
          {price && !errors.price ? (
            <Text style={{
              color: Colors.headerFooter,
              fontSize: 12,
              marginTop: 4,
              fontFamily: 'Poppins',
            }}>
              Your share: ₹{userShare}
            </Text>
          ) : null}
        </View>
        
        {/* Duration Selection */}
        <View style={{ marginBottom: 15 }}>
          <Text style={{
            fontSize: 16,
            color: '#666',
            marginBottom: 8,
            fontFamily: 'Poppins',
          }}>
            Group Duration
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setDuration(1)}
              style={{
                padding: 12,
                borderWidth: 2,
                borderColor: duration === 1 ? Colors.headerFooter : '#ddd',
                borderRadius: 8,
                backgroundColor: duration === 1 ? Colors.headerFooter : '#f8f9fa',
                flex: 1,
              }}
            >
              <Text style={{
                textAlign: 'center',
                color: duration === 1 ? 'white' : '#333',
                fontFamily: 'Poppins',
              }}>
                30 Days
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDuration(2)}
              style={{
                padding: 12,
                borderWidth: 2,
                borderColor: duration === 2 ? Colors.headerFooter : '#ddd',
                borderRadius: 8,
                backgroundColor: duration === 2 ? Colors.headerFooter : '#f8f9fa',
                flex: 1,
              }}
            >
              <Text style={{
                textAlign: 'center',
                color: duration === 2 ? 'white' : '#333',
                fontFamily: 'Poppins',
              }}>
                60 Days
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Topic Selection */}
        <View style={{ marginBottom: 15 }}>
          <Text style={{
            fontSize: 16,
            color: '#666',
            marginBottom: 8,
            fontFamily: 'Poppins',
          }}>
            Topic
          </Text>
          {loadingTopics ? (
            <View style={{
              borderWidth: 2,
              borderColor: '#ddd',
              borderRadius: 8,
              backgroundColor: '#f8f9fa',
              height: 50,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <ActivityIndicator size="small" color="#666" />
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 10 }}
            >
              {topics.map((topic) => (
                <TouchableOpacity
                  key={topic.id}
                  onPress={() => setSelectedTopic(topic.id)}
                  style={{
                    padding: 12,
                    marginRight: 10,
                    borderWidth: 2,
                    borderColor: selectedTopic === topic.id ? Colors.headerFooter : '#ddd',
                    borderRadius: 8,
                    backgroundColor: selectedTopic === topic.id ? Colors.headerFooter : '#f8f9fa',
                  }}
                >
                  <Text style={{
                    color: selectedTopic === topic.id ? 'white' : '#333',
                    fontFamily: 'Poppins',
                    fontSize: 14,
                  }}>
                    {topic.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {errors.topic ? (
            <Text style={{ color: Colors.headerFooter, fontSize: 12, marginTop: 4 }}>
              {errors.topic}
            </Text>
          ) : null}
        </View>
        
        {/* Terms and Notes */}
        <View style={{
          marginBottom: 40,
          padding: 16,
          backgroundColor: '#f8f9fa',
          borderRadius: 8,
        }}>
          <Text style={{
            fontSize: 14,
            color: '#333',
            lineHeight: 20,
            fontFamily: 'Poppins',
            fontWeight: 'bold',
          }}>
            Note:
          </Text>
          <Text style={{
            fontSize: 12,
            color: '#333',
            lineHeight: 18,
            fontFamily: 'Poppins',
            marginTop: 8,
          }}>
            1. Groups activate only if a minimum of 2 people join the group{"\n"}
            2. You will only be able to withdraw cash after the group expires in 30/60 days after activation{"\n"}
            3. You can send direct messages to any member but they cannot reply on 1:1 chats{"\n"}
            4. Please read the rules and instructions carefully{" "}
            <Text style={{ color: '#3498db', textDecorationLine: 'underline' }}>
              here
            </Text>
          </Text>
        </View>
        
        {/* Create Button */}
        <TouchableOpacity
          onPress={handleCreateGroup}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#bdc3c7' : Colors.headerFooter,
            paddingVertical: 18,
            borderRadius: 28,
            alignItems: 'center',
            marginBottom: 40,
            width: '60%',
            alignSelf: 'center',
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={{
              color: 'white',
              fontSize: 16,
              fontWeight: '600',
              fontFamily: 'Poppins',
            }}>
              Create Group
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}