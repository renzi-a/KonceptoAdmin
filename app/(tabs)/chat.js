import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking, // Added for opening attachments
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { BASE_STORAGE_URL, BASE_URL } from '../../config'; // Ensure BASE_URL and BASE_STORAGE_URL are correct

const Colors = {
  primaryGreen: '#25D366',
  darkText: '#1C1C1E',
  greyBackground: '#F0F2F5',
  border: '#ccc',
  white: '#FFFFFF',
  red: '#EF4444',
  lightGrey: '#e0e0e0',
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
  const [newMessage, setNewMessage] = useState('');
  const [attachment, setAttachment] = useState(null);

  const router = useRouter();
  const messagesScrollViewRef = useRef(null);

  // Effect 1: Initialize API Client and Admin ID
  useEffect(() => {
    const setupApiClient = async () => {
      try {
        const adminId = await AsyncStorage.getItem('adminId');

        if (!adminId) {
          Alert.alert('Authentication Required', 'Please log in to access chat.');
          router.replace('/index');
          return;
        }

        const parsedAdminId = parseInt(adminId, 10);

        if (isNaN(parsedAdminId) || parsedAdminId <= 0) {
            Alert.alert('Authentication Error', 'Invalid admin ID. Please log in again.');
            router.replace('/index');
            return;
        }

        setCurrentAdminId(parsedAdminId);
        
        const instance = axios.create({
          baseURL: BASE_URL,
          headers: {
            'X-Admin-ID': adminId,
            'Accept': 'application/json',
          },
        });
        setApiClient(instance);
        setIsChatClientReady(true);

        await fetchUsers(instance, parsedAdminId); 

      } catch (error) {
        console.error('ERROR in setupApiClient:', error);
        Alert.alert('Error', 'Failed to initialize chat. Please log in again.');
        router.replace('/index');
      }
    };
    setupApiClient();
  }, []);

  // Effect for fetching messages (depends on activeUser and apiClient)
  useEffect(() => {
    if (activeUser && apiClient) {
      fetchMessages(apiClient, activeUser.id);
    }
  }, [activeUser, apiClient]);


  const fetchUsers = async (client, adminId) => {
    if (!client || typeof client.get !== 'function' || !adminId) {
      setLoadingUsers(false);
      return;
    }

    setLoadingUsers(true);
    try {
      const response = await client.get('/chat.php?action=users');
      
      if (Array.isArray(response.data)) {
        setUsers(response.data);

        if (!activeUser && response.data.length > 0) {
          setActiveUser(response.data[0]);
        } else if (response.data.length === 0) {
          setActiveUser(null);
        }
      } else {
        console.error('Expected array but received:', response.data);
        Alert.alert('Error', response.data.message || 'Received unexpected data format from user API.');
        setUsers([]);
        setActiveUser(null);
      }
    } catch (error) {
      console.error('ERROR during API call (fetchUsers):', error);
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 401) {
          Alert.alert('Session Expired', error.response.data.error || 'Your session has expired. Please log in again.');
          await AsyncStorage.removeItem('adminId');
          await AsyncStorage.removeItem('isLoggedIn');
          router.replace('/index');
        } else {
          Alert.alert('Error', error.response.data.message || 'Could not load chat users. Server error.');
        }
      } else if (axios.isAxiosError(error)) {
        Alert.alert('Network Error', 'Could not connect to the server. Please check your internet connection or server status.');
      } else {
        Alert.alert('Error', 'An unexpected error occurred while loading users.');
      }
      setUsers([]);
      setActiveUser(null);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchMessages = async (client, userId) => {
    if (!client || typeof client.get !== 'function' || !userId) {
      setMessages([]);
      setLoadingMessages(false);
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
      console.error('ERROR during API call (fetchMessages):', error);
      Alert.alert('Error', 'Could not load messages.');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const pickAttachment = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please grant media library permissions to upload images.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      setAttachment(result.assets[0]);
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
  };

  const sendMessage = async () => {
    if (!activeUser || (!newMessage.trim() && !attachment)) {
      return;
    }

    setLoadingMessages(true);
    const formData = new FormData();
    formData.append('action', 'send_message');
    formData.append('receiver_id', activeUser.id);
    formData.append('message', newMessage.trim());
    formData.append('sender_id', currentAdminId);

    if (attachment) {
      const uriParts = attachment.uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      const fileName = attachment.fileName || `attachment_${Date.now()}.${fileType}`; // Use fileName if available, fallback
      
      formData.append('attachment', {
        uri: attachment.uri,
        name: fileName,
        type: attachment.mimeType || `application/octet-stream`, // Default to generic binary if unknown
      });
    }

    try {
      const response = await apiClient.post('/chat.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setNewMessage('');
        setAttachment(null);
        fetchMessages(apiClient, activeUser.id); 
      } else {
        Alert.alert('Error Sending Message', response.data.message || 'Failed to send message.');
      }
    } catch (error) {
      console.error('ERROR sending message:', error);
      Alert.alert('Error', 'Could not send message. Please try again.');
    } finally {
      setLoadingMessages(false);
    }
  };

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
          {msg.attachment && (
            <TouchableOpacity onPress={() => Linking.openURL(`${BASE_STORAGE_URL}/${msg.attachment}`)}>
                {msg.attachment.match(/\.(jpeg|jpg|png|gif)$/i) ? (
                    <Image 
                        source={{ uri: `${BASE_STORAGE_URL}/${msg.attachment}` }} 
                        style={styles.messageAttachmentImage} 
                        resizeMode="contain"
                    />
                ) : (
                    <View style={styles.messageAttachmentFile}>
                        <Icon name="document-text-outline" size={20} color={isOwn ? Colors.white : Colors.darkText} />
                        <Text style={[styles.messageAttachmentText, isOwn ? styles.messageOwnText : Colors.darkText]}>
                            {msg.original_name || 'Attachment'}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
          )}
          <Text style={[styles.messageTime, isOwn ? styles.messageOwnText : styles.messageOtherText]}>
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
        {/* Sidebar for user list */}
        <View style={styles.sidebar}>
          <Text style={styles.sidebarHeader}>School Admins</Text>
          <FlatList
            data={users}
            renderItem={renderUser}
            keyExtractor={(item) => item.id ? item.id.toString() : Math.random().toString()}
            contentContainerStyle={styles.userListContent}
          />
        </View>

        {/* Chat Box (main chat area) */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.chatBox}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} 
        >
          {loadingMessages ? (
            <ActivityIndicator size="large" color={Colors.primaryGreen} />
          ) : activeUser ? (
            <>
              <ScrollView
                ref={messagesScrollViewRef}
                style={styles.messagesArea}
                contentContainerStyle={styles.messagesContent}
              >
                {messages.length > 0 ? (
                  messages.map(renderMessage)
                ) : (
                  <View style={styles.chatBoxEmpty}>
                    <Text style={styles.noUserText}>No messages yet. Start a conversation!</Text>
                  </View>
                )}
              </ScrollView>

              {/* Attachment preview */}
              {attachment && (
                <View style={styles.attachmentPreview}>
                  {attachment.type && attachment.type.startsWith('image/') ? (
                    <Image source={{ uri: attachment.uri }} style={styles.attachmentImagePreview} />
                  ) : (
                    <View style={styles.attachmentFilePreview}>
                      <Icon name="document-text-outline" size={24} color={Colors.darkText} />
                      <Text style={styles.attachmentFileName}>{attachment.name || 'Selected File'}</Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={removeAttachment} style={styles.removeAttachmentButton}>
                    <Icon name="close-circle" size={24} color={Colors.red} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Message Input Area */}
              <View style={styles.inputContainer}>
                <TouchableOpacity onPress={pickAttachment} style={styles.attachmentButton}>
                  <Icon name="attach-outline" size={24} color={Colors.primaryGreen} />
                </TouchableOpacity>
                <TextInput
                  style={styles.messageInput}
                  placeholder="Type a message..."
                  value={newMessage}
                  onChangeText={setNewMessage}
                  multiline
                  placeholderTextColor={Colors.darkText}
                />
                <TouchableOpacity 
                  onPress={sendMessage} 
                  style={[
                    styles.sendButton, 
                    (newMessage.trim() || attachment) ? { opacity: 1 } : { opacity: 0.5 }
                  ]}
                  disabled={!newMessage.trim() && !attachment}
                >
                  <Icon name="send" size={24} color={Colors.white} />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.chatBoxEmpty}>
              <Text style={styles.noUserText}>Select a school admin to start chatting.</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    marginTop: Platform.OS === 'android' ? 0 : 35,
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
    width: Dimensions.get('window').width < 768 ? '100%' : '30%',
    backgroundColor: Colors.white,
    borderRightWidth: Dimensions.get('window').width < 768 ? 0 : StyleSheet.hairlineWidth,
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
    color: Colors.darkText, // Changed from greyBackground to darkText for better visibility
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
    borderWidth: 1,
    borderColor: Colors.lightGrey,
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
  // New styles for input and attachment
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.white,
    borderRadius: 25,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.lightGrey,
  },
  messageInput: {
    flex: 1,
    paddingHorizontal: 10,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 16,
    color: Colors.darkText,
  },
  attachmentButton: {
    padding: 5,
    marginRight: 5,
  },
  sendButton: {
    backgroundColor: Colors.primaryGreen,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.lightGrey,
  },
  attachmentImagePreview: {
    width: 60,
    height: 60,
    borderRadius: 4,
    marginRight: 10,
  },
  attachmentFilePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  attachmentFileName: {
    fontSize: 14,
    color: Colors.darkText,
    marginLeft: 5,
    flexShrink: 1,
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: Colors.white,
    borderRadius: 15,
  },
  messageAttachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginTop: 5,
  },
  messageAttachmentFile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    backgroundColor: Colors.lightGrey,
    padding: 8,
    borderRadius: 8,
  },
  messageAttachmentText: {
    marginLeft: 5,
    fontWeight: 'bold',
  }
});