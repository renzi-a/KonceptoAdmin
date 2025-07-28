// app/(tabs)/_layout.js

import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native'; // <-- Corrected import
import Icon from 'react-native-vector-icons/Ionicons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4CAF50', // Green-500
        tabBarInactiveTintColor: '#7F8C8D', // Gray-600
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
 
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Icon name="home" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <Icon name="chatbubbles" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="gatheringOrder"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => <Icon name="list" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Icon name="settings" color={color} size={24} />,
        }}
      />

      {/* Hidden screens (href: null) for navigation that don't appear in the tab bar.
          Ensure these names match your file structure exactly. */}
      <Tabs.Screen
        name="gathering"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="orders/orderdetails"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="admin/users"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="admin/schools"
        options={{
          href: null,
        }}
      />
      {/* This is the dynamic route for individual gathering order details */}
      <Tabs.Screen
        name="order/gathering/[orderId]"
        options={{
          href: null, // Hidden from tab bar
        }}
      />
      <Tabs.Screen
        name="admin/order/gathering"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="order/delivery"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 60,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 5,
    // Add shadow for better elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5, // For Android shadow
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -5,
  },
  tabBarItem: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
  },
});