import React from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { colors, radii, spacing } from '@/theme';


// Tab bar icon component using Ionicons for better consistency
function TabBarIcon(props: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) {
  return <Ionicons size={24} style={{ marginBottom: -3 }} {...props} />;
}

// Tab bar icon component for custom images
function TabBarImage(props: {
  source: any;
  focusedSource?: any;
  focused?: boolean;
}) {
  return (
    <View style={{
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10
    }}>
      <Image 
        source={props.focused && props.focusedSource ? props.focusedSource : props.source} 
        style={{
          width: 37,
          height: 37,
          resizeMode: 'contain',
        }}
        resizeMode="contain"
      />
    </View>
  );
}

// Move Header component outside and pass insets as props
export const Header = ({ insets, backgroundColor = 'transparent', backButtonVisible = false }: { insets: any, backgroundColor?: string, backButtonVisible?: boolean }) => {
  return (
    <View style={{ 
      backgroundColor: backgroundColor,
     }}>
      <View style={{ 
        flexDirection: 'row',
        backgroundColor: colors.navigation.header,
        paddingTop: insets.top,
        paddingHorizontal: spacing.xxl,
        paddingBottom: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
        borderBottomLeftRadius: radii.navigation,
        borderBottomRightRadius: radii.navigation,
      }}>

        {backButtonVisible && (
          <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', left: spacing.xxl, bottom: spacing.xxxl }}>
            <Ionicons name="chevron-back" size={24} color={colors.text.inverse} />
          </TouchableOpacity>
        )}

        <Image 
          source={require('@/assets/images/logo_appbar.png')} 
          style={{
            maxWidth: 200,
            height: 40,
          }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.navigation.activeTab,
        tabBarInactiveTintColor: colors.navigation.inactiveTab,
        tabBarLabelStyle: {
          marginTop: 2,
          fontSize: 11
        },
        tabBarStyle: {
          backgroundColor: colors.navigation.header,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 5,
          paddingTop: spacing.xxl,
          paddingHorizontal: spacing.sectionInset,
          height: 70 + (insets.bottom > 0 ? insets.bottom : 0),
        },
        tabBarItemStyle: {
          paddingHorizontal: spacing.sm,
        },
        headerShown: true,
        header: () => <Header insets={insets} />,
      }}>
      
      {/* Tab 0: Chats */}
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ focused }) => (
            <TabBarImage 
              source={require('@/assets/images/navbar/chat.png')} 
              focused={focused}
            />
          ),
          // Using global header from tab layout
        }}
      />
      
      {/* Tab 1: Explore (Group Search) */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ focused }) => (
            <TabBarImage 
              source={require('@/assets/images/navbar/explore.png')} 
              focused={focused}
            />
          ),
          // Using global header from tab layout
        }}
      />

      {/* Tab 2: Home (Center) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabBarImage 
              source={require('@/assets/images/navbar/home.png')} 
              focused={focused}
              focusedSource={require('@/assets/images/navbar/home_active.png')}
            />
          ),
          header: () => <Header insets={insets} backgroundColor={colors.chat.outgoing} />,
        }}
      />
      
      {/* Tab 3: Wallet (Credits) */}
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ focused }) => (
            <TabBarImage 
              source={require('@/assets/images/navbar/wallet.png')} 
              focused={focused}
            />
          ),
          header: () => <Header insets={insets} backgroundColor={colors.surface.subtle} />,
          // Using global header from tab layout
        }}
      />
      
      {/* Tab 4: Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ focused }) => (
            <TabBarImage 
              source={require('@/assets/images/navbar/you.png')} 
              focused={focused}
            />
          ),
          header: () => <Header insets={insets} backgroundColor={colors.navigation.profileHeader} />,
          // Using global header from tab layout
        }}
      />
      
      {/* Hidden screens within tabs - no tab bar icons */}
      <Tabs.Screen
        name="create-group"
        options={{
          href: null, // This hides it from the tab bar
          headerShown: false, // Use its own header
        }}
      />

      {/* Hide the old home.tsx file from tab bar */}
      <Tabs.Screen
        name="home"
        options={{
          href: null, // This hides it from the tab bar
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
