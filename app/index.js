import AsyncStorage from '@react-native-async-storage/async-storage';
import Checkbox from 'expo-checkbox';
import { useRouter } from 'expo-router';
import { Formik } from 'formik';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as yup from 'yup';

import CustomModal from '../components/CustomModal';
import { login } from '../services/api';

const logo = require('../assets/images/logo.png');

const loginValidationSchema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email')
    .required('Email is required'),
  password: yup
    .string()
    .min(6, ({ min }) => `Password must be at least ${min} characters`)
    .required('Password is required'),
});

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [initialValues, setInitialValues] = useState({ email: '', password: '' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [showLoginStatusModal, setShowLoginStatusModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalIsSuccess, setModalIsSuccess] = useState(false); // To track if login was successful
  const [isModalLoading, setIsModalLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const loadCredentials = async () => {
      const savedEmail = await AsyncStorage.getItem('email');
      const savedPassword = await AsyncStorage.getItem('password');

      if (savedEmail && savedPassword) {
        setInitialValues({ email: savedEmail, password: savedPassword });
        setRememberMe(true);
      }
    };

    loadCredentials();
  }, []);

  const handleLogin = async (values) => {
    setIsLoggingIn(true);
    console.log('Attempting login...'); // Debugging: Start of login attempt

    try {
      console.log('Sending login request to API...'); // Debugging: Before API call
      const res = await login(values.email, values.password);
      console.log('Login API response:', res); // Debugging: Log the API response

      if (res && res.token) { // Check for `res` first, then `res.token`
        console.log('Login successful. Storing data...'); // Debugging: Success condition met
        await AsyncStorage.setItem('token', res.token);
        await AsyncStorage.setItem('isLoggedIn', 'true');
        await AsyncStorage.setItem('adminId', res.user.id.toString());

        if (rememberMe) {
          await AsyncStorage.setItem('email', values.email);
          await AsyncStorage.setItem('password', values.password);
        } else {
          await AsyncStorage.removeItem('email');
          await AsyncStorage.removeItem('password');
        }

        setModalTitle('Login Successful!');
        setModalMessage(`Welcome, ${res.user.first_name}!`);
        setModalIsSuccess(true);
        setShowLoginStatusModal(true);

      } else {
        console.log('Login failed or incomplete response:', res); // Debugging: Failure condition met
        setModalTitle('Login Failed');
        setModalMessage(res?.message || 'Invalid credentials. Please try again.');
        setModalIsSuccess(false);
        setShowLoginStatusModal(true);
      }
    } catch (error) {
      console.error('Login request failed with error:', error); // Debugging: Log the actual error object
      const errorMessage = error.response?.data?.message || error.message || 'Something went wrong. Please check your network connection.';
      setModalTitle('Error');
      setModalMessage(errorMessage);
      setModalIsSuccess(false);
      setShowLoginStatusModal(true);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleModalClose = () => {
    setShowLoginStatusModal(false);
    if (modalIsSuccess) {
      setTimeout(() => {
        router.replace('/(tabs)/home');
      }, 100);
    }
  };

  // ... (rest of the component and styles are unchanged)
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.fullScreen}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Image source={logo} style={styles.logo} />
        <Text style={styles.title}>Koncepto Admin</Text>
        <Text style={styles.subtitle}>Log in to manage your business</Text>

        <Formik
          validationSchema={loginValidationSchema}
          enableReinitialize
          initialValues={initialValues}
          onSubmit={handleLogin}
        >
          {({
            handleChange,
            handleBlur,
            handleSubmit,
            values,
            errors,
            touched,
            isValid,
          }) => (
            <View style={styles.formContainer}>
              <View style={[styles.inputContainer, touched.email && errors.email && styles.inputErrorBorder]}>
                <Icon name="mail-outline" size={22} style={styles.icon} color="#606060" />
                <TextInput
                  placeholder="Email Address"
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onChangeText={handleChange('email')}
                  onBlur={handleBlur('email')}
                  value={values.email}
                  placeholderTextColor="#a0a0a0"
                  selectionColor="#4CAF50"
                />
              </View>
              {touched.email && errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}

              <View style={[styles.inputContainer, touched.password && errors.password && styles.inputErrorBorder]}>
                <Icon name="lock-closed-outline" size={22} style={styles.icon} color="#606060" />
                <TextInput
                  placeholder="Password"
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  onChangeText={handleChange('password')}
                  onBlur={handleBlur('password')}
                  value={values.password}
                  placeholderTextColor="#a0a0a0"
                  selectionColor="#4CAF50"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIconTouchable}>
                  <View>
                    <Icon
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color="#606060"
                    />
                  </View>
                </TouchableOpacity>

               </View>
               {touched.password && errors.password && (
                 <Text style={styles.errorText}>{errors.password}</Text>
               )}

               <View style={styles.checkboxContainer}>
                 <Checkbox
                   value={rememberMe}
                   onValueChange={setRememberMe}
                   color={rememberMe ? '#4CAF50' : '#b0b0b0'}
                 />
                 <Text style={styles.checkboxLabel}>Remember Me</Text>
               </View>

               <TouchableOpacity
                 style={[
                   styles.button,
                   { backgroundColor: isValid && !isLoggingIn ? '#4CAF50' : '#A5D6A7' },
                 ]}
                 onPress={handleSubmit}
                 disabled={!isValid || isLoggingIn}
               >
                 {isLoggingIn ? (
                   <ActivityIndicator color="#fff" size="small" />
                 ) : (
                   <Text style={styles.buttonText}>Login</Text>
                 )}
               </TouchableOpacity>
             </View>
           )}
         </Formik>
       </ScrollView>

       <CustomModal
         isVisible={showLoginStatusModal}
         onClose={handleModalClose}
         title={modalTitle}
         message={modalMessage}
         primaryButtonText="OK"
         onPrimaryButtonPress={handleModalClose}
         isLoading={isModalLoading}
         backdropDismiss={!isModalLoading}
         showCloseButton={!isModalLoading}
       >
       </CustomModal>

     </KeyboardAvoidingView>
   );
 }

 const styles = StyleSheet.create({
   fullScreen: {
     flex: 1,
   },
   container: {
     flexGrow: 1,
     backgroundColor: '#F8F9FA',
     justifyContent: 'center',
     alignItems: 'center',
     paddingHorizontal: 25,
     paddingVertical: 40,
   },
   logo: {
     height: 180,
     width: 180,
     resizeMode: 'contain',
     marginBottom: 20,
   },
   title: {
     fontSize: 32,
     fontWeight: '700',
     color: '#34495E',
     marginBottom: 8,
   },
   subtitle: {
     fontSize: 16,
     color: '#7F8C8D',
     marginBottom: 35,
     textAlign: 'center',
   },
   formContainer: {
     width: '100%',
     maxWidth: 400,
     alignItems: 'center',
   },
   inputContainer: {
     flexDirection: 'row',
     alignItems: 'center',
     width: '100%',
     backgroundColor: '#FFFFFF',
     borderRadius: 12,
     paddingHorizontal: 15,
     height: 52,
     marginBottom: 15,
     borderColor: '#E0E0E0',
     borderWidth: 1,
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.05,
     shadowRadius: 3,
     elevation: 2,
   },
   inputErrorBorder: {
     borderColor: '#EF5350',
     borderWidth: 1.5,
   },
   icon: {
     marginRight: 12,
   },
   input: {
     flex: 1,
     fontSize: 17,
     color: '#333333',
     paddingVertical: 0,
   },
   eyeIconTouchable: {
     paddingLeft: 10,
   },
   checkboxContainer: {
     flexDirection: 'row',
     alignItems: 'center',
     marginVertical: 10,
     justifyContent: 'flex-end',
     width: '100%',
   },
   checkboxLabel: {
     marginLeft: 10,
     fontSize: 14,
     color: '#555555',
   },
   button: {
     width: '100%',
     height: 55,
     borderRadius: 12,
     justifyContent: 'center',
     alignItems: 'center',
     marginTop: 25,
     shadowColor: '#4CAF50',
     shadowOffset: { width: 0, height: 5 },
     shadowOpacity: 0.3,
     shadowRadius: 8,
     elevation: 5,
   },
   buttonText: {
     color: '#FFFFFF',
     fontSize: 19,
     fontWeight: 'bold',
     letterSpacing: 0.5,
   },
   errorText: {
     color: '#EF5350',
     alignSelf: 'flex-start',
     marginBottom: 10,
     fontSize: 13,
     fontWeight: '500',
     paddingLeft: 5,
   },
 });