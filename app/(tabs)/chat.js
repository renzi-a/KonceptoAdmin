import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BASE_STORAGE_URL, BASE_URL } from '../../config';

const Colors = {
  primaryGreen: '#25D366',
  darkText: '#1C1C1E',
  greyBackground: '#F0F2F5',
  border: '#ccc',
  white: '#FFFFFF',
  red: '#EF4444',
};

export default function ChatScreen() {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState(null);
  const [apiClient, setApiClient] = useState(null);
  const [isChatClientReady, setIsChatClientReady] = useState(false);

  const router = useRouter();
  const { width } = Dimensions.get('window');
  const isMobileLayout = width < 768;
  const messagesScrollViewRef = useRef(null);

  useEffect(() => {
    const setupApiClient = async () => {
      try {
        const adminId = await AsyncStorage.getItem('adminId');
        if (!adminId) {
          Alert.alert('Authentication Required', 'Please log in to access chat.');
          router.replace('/index');
          return;
        }
        setCurrentAdminId(parseInt(adminId, 10));
        const instance = axios.create({
          baseURL: BASE_URL,
          headers: {
            'X-Admin-ID': adminId,
            'Accept': 'application/json',
          },
        });
        setApiClient(instance);
        setIsChatClientReady(true);
      } catch (error) {
        Alert.alert('Error', 'Failed to initialize chat. Please log in again.');
        router.replace('/index');
      }
    };
    setupApiClient();
  }, []);

  const fetchUsers = async (client, adminId) => {
    if (!client || typeof client.get !== 'function' || !adminId) {
      setLoadingUsers(true);
      return;
    }
    setLoadingUsers(true);
    try {
      const response = await client.get('/chat.php?action=users');
      setUsers(response.data);
      if (!activeUser && response.data.length > 0) {
        setActiveUser(response.data[0]);
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        Alert.alert('Session Expired', 'Your session has expired. Please log in again.');
        await AsyncStorage.removeItem('adminId');
        await AsyncStorage.removeItem('isLoggedIn');
        router.replace('/index');
      } else {
        Alert.alert('Error', 'Could not load chat users.');
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchMessages = async (client, userId) => {
    if (!client || typeof client.get !== 'function' || !userId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    try {
      const response = await client.get(`/chat.php?action=messages&user_id=${userId}`);
      setMessages(response.data);
      setTimeout(() => {
        messagesScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      Alert.alert('Error', 'Could not load messages.');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (isChatClientReady && apiClient && typeof apiClient.get === 'function' && currentAdminId) {
      fetchUsers(apiClient, currentAdminId);
    }
  }, [isChatClientReady, apiClient, currentAdminId]);

  useEffect(() => {
    if (activeUser && apiClient) {
      fetchMessages(apiClient, activeUser.id);
    }
  }, [activeUser, apiClient]);

  const renderUser = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.userItem,
        activeUser?.id === item.id && styles.activeUserItem,
      ]}
      onPress={() => setActiveUser(item)}
    >
      {item.school?.image ? (
        <Image
          source={{ uri: `${BASE_STORAGE_URL}/${item.school.image}` }}
          style={styles.userAvatar}
        />
      ) : (
        <View style={styles.userInitials}>
          <Text style={styles.userInitialsText}>
            {`${item.first_name?.[0] || ''}${item.last_name?.[0] || ''}`.toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.userSchool} numberOfLines={1}>{item.school?.school_name || 'N/A School'}</Text>
        <Text style={styles.userName} numberOfLines={1}>{item.first_name} {item.last_name}</Text>
        {item.last_message && (
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.last_message}
          </Text>
        )}
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{item.unread_count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderMessage = (msg) => {
    const isOwn = msg.sender_id === currentAdminId;
    return (
      <View
        key={msg.id}
        style={[
          styles.messageBubbleContainer,
          isOwn ? styles.messageOwn : styles.messageOther,
        ]}
      >
        <View style={[styles.messageBubble, isOwn ? styles.messageOwnBubble : styles.messageOtherBubble]}>
          <Text style={[styles.messageText, isOwn ? styles.messageOwnText : styles.messageOtherText]}>
            {msg.message}
          </Text>
          <Text style={styles.messageTime}>
            {msg.created_at}
          </Text>
        </View>
      </View>
    );
  };

  if (!isChatClientReady) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primaryGreen} />
        <Text style={styles.loadingText}>Initializing chat client...</Text>
      </SafeAreaView>
    );
  }

  if (loadingUsers) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primaryGreen} />
        <Text style={styles.loadingText}>Loading chat users...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.chatContainer}>
        <View style={styles.sidebar}>
          <Text style={styles.sidebarHeader}>School Admins</Text>
          <FlatList
            data={users}
            renderItem={renderUser}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.userListContent}
          />
        </View>
        <View style={styles.chatBox}>
          {loadingMessages ? (
            <ActivityIndicator size="large" color={Colors.primaryGreen} />
          ) : activeUser && messages.length > 0 ? (
            <ScrollView
              ref={messagesScrollViewRef}
              style={styles.messagesArea}
              contentContainerStyle={styles.messagesContent}
            >
              {messages.map(renderMessage)}
            </ScrollView>
          ) : (
            <View style={styles.chatBoxEmpty}>
              <Text style={styles.noUserText}>
                {activeUser
                  ? 'No messages yet. Start a conversation!'
                  : 'Select a school admin to start chatting.'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    marginTop: 35,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.greyBackground,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.darkText,
  },
  chatContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: Platform.OS === 'web' ? '30%' : '100%',
    backgroundColor: Colors.white,
    borderRightWidth: Platform.OS === 'web' ? StyleSheet.hairlineWidth : 0,
    borderRightColor: Colors.border,
  },
  sidebarHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.darkText,
    padding: 15,
  },
  userListContent: {
    paddingBottom: 10,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  activeUserItem: {
    backgroundColor: '#E6F3EA',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  userInitials: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primaryGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInitialsText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 18,
    textTransform: 'uppercase',
  },
  userInfo: {
    flex: 1,
  },
  userSchool: {
    fontWeight: '600',
    color: Colors.darkText,
    fontSize: 15,
  },
  userName: {
    fontSize: 13,
    color: Colors.darkText,
  },
  lastMessage: {
    fontSize: 12,
    color: Colors.greyBackground,
    marginTop: 2,
  },
  unreadBadge: {
    backgroundColor: Colors.red,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  unreadBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatBox: {
    flex: 1,
    backgroundColor: Colors.greyBackground,
    padding: 10,
  },
  chatBoxEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.greyBackground,
  },
  noUserText: {
    fontSize: 18,
    color: Colors.darkText,
    textAlign: 'center',
    marginHorizontal: 20,
  },
  messagesArea: {
    flex: 1,
  },
  messagesContent: {
    paddingBottom: 20,
  },
  messageBubbleContainer: {
    marginVertical: 4,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  messageOwn: {
    justifyContent: 'flex-end',
  },
  messageOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 8,
  },
  messageOwnBubble: {
    backgroundColor: Colors.primaryGreen,
    alignSelf: 'flex-end',
  },
  messageOtherBubble: {
    backgroundColor: Colors.white,
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 15,
  },
  messageOwnText: {
    color: Colors.white,
  },
  messageOtherText: {
    color: Colors.darkText,
  },
  messageTime: {
    fontSize: 11,
    color: Colors.darkText,
    marginTop: 4,
    textAlign: 'right',
  },
});