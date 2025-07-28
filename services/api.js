import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Alert } from 'react-native';
import { BASE_URL } from '../config'; // Ensure this path is correct

console.log( 'BASE_URL:' , BASE_URL, axios);

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

export const apiRequest = async (method, endpoint, data = null, headers = {}) => {
  try {
    const config = {
      method: method,
      // --- THIS IS THE CRITICAL CHANGE ---
      // We explicitly tell Axios to target 'order.php' and pass the original 'endpoint'
      // as a query parameter named 'endpoint'.
      url: `/order.php?endpoint=${encodeURIComponent(endpoint)}`, 
      // --- END CRITICAL CHANGE ---
      headers: { ...apiClient.defaults.headers.common, ...headers },
      data: data,
    };

    const response = await apiClient(config);
    return response.data;
  } catch (error) {
    console.error('API Request Error:', error.response?.data || error.message);
    Alert.alert('Network Error', error.response?.data?.message || 'Could not connect to the server. Please check your network and try again.');
    throw error;
  }
};


// Function to handle user login
export const login = async (email, password) => {
  try {
    console.log('Login function in services/api.js called. Attempting apiClient.post...');
    const response = await apiClient.post('/login.php', { // Assuming login.php is directly under BASE_URL
      email,
      password,
    });
    console.log('Login API response from services/api.js:', response.data);
    return response.data; // This should contain token and user object
  } catch (error) {
    console.error('Error in services/api.js login function:', error.response?.data || error.message);
    // Re-throw to be handled by the calling component (e.g., LoginScreen)
    throw error;
  }
};

// Function to get token (if needed elsewhere, though chat uses X-Admin-ID)
export const getToken = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    return token;
  } catch (error) {
    console.error('Error getting token from AsyncStorage:', error);
    return null;
  }
};

// Function to handle user logout
export const logout = async () => {
  try {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('isLoggedIn');
    await AsyncStorage.removeItem('adminId'); // Crucial for chat screen authentication
    await AsyncStorage.removeItem('email'); // Clear remembered email
    await AsyncStorage.removeItem('password'); // Clear remembered password
    console.log('User logged out and AsyncStorage cleared.');
    return true;
  } catch (error) {
    console.error('Error during logout:', error);
    return false;
  }
};