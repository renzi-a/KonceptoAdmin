import Ionicons from '@expo/vector-icons/Ionicons';
// No need to import AsyncStorage directly here, as `logout` from services/api handles it
import { useRouter } from 'expo-router';
import { Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Import the logout function from your services/api.js
import { logout } from '../../services/api';

// Define a color palette for consistency
const Colors = {
    primaryGreen: '#25D366',
    darkText: '#1C1C1E',
    mediumGrey: '#65676B',
    lightGrey: '#E0E0E0',
    white: '#FFFFFF',
    red: '#EF4444',
    lightBackground: '#F0F2F5',
    cardBackground: '#FFFFFF',
    borderColor: '#E0E0E0',
};

export default function SettingsScreen() {
    const router = useRouter();

    const handleLogout = async () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to log out?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Logout",
                    onPress: async () => {
                        // Call the centralized logout function from services/api.js
                        const success = await logout();
                        if (success) {
                            console.log('User logged out successfully via centralized logout.');
                            // FIX: Redirect to the absolute root path, which is your login screen (app/index.js)
                            router.replace('/'); 
                        } else {
                            // The logout function in services/api.js already logs errors
                            Alert.alert("Logout Failed", "Could not log out. Please try again.");
                        }
                    },
                    style: "destructive"
                }
            ],
            { cancelable: true }
        );
    };

    // Function to navigate to a specific screen
    const navigateTo = (path) => {
        router.push(path);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollViewContent}>
                <Text style={styles.headerTitle}>Admin Settings</Text>

                {/* Management Section */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Management</Text>
                    <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('admin/users')}>
                        <Ionicons name="people-outline" size={24} color={Colors.primaryGreen} style={styles.menuIcon} />
                        <Text style={styles.menuItemText}>User Management</Text>
                        <Ionicons name="chevron-forward-outline" size={20} color={Colors.mediumGrey} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('admin/schools')}>
                        <Ionicons name="school-outline" size={24} color={Colors.primaryGreen} style={styles.menuIcon} />
                        <Text style={styles.menuItemText}>School Management</Text>
                        <Ionicons name="chevron-forward-outline" size={20} color={Colors.mediumGrey} />
                    </TouchableOpacity>
                </View>


                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={24} color={Colors.white} style={styles.menuIcon} />
                    <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.lightBackground,
        paddingTop: Platform.OS === 'android' ? 35 : 0, // Adjust for Android status bar
    },
    scrollViewContent: {
        paddingVertical: 20,
        paddingHorizontal: 15,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.darkText,
        marginBottom: 25,
        textAlign: 'center',
    },
    sectionContainer: {
        backgroundColor: Colors.cardBackground,
        borderRadius: 12,
        marginBottom: 20,
        overflow: 'hidden', // Ensures border radius applies to children
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.mediumGrey,
        paddingHorizontal: 15,
        paddingTop: 15,
        paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.borderColor,
        backgroundColor: Colors.lightBackground, // Slightly different background for section title
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 15,
        backgroundColor: Colors.cardBackground,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.borderColor,
    },
    menuIcon: {
        marginRight: 15,
    },
    menuItemText: {
        flex: 1, // Take up remaining space
        fontSize: 17,
        color: Colors.darkText,
    },
    // Specific style for the last item in a section to remove its bottom border
    lastMenuItem: {
        borderBottomWidth: 0,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.red,
        borderRadius: 12,
        paddingVertical: 15,
        marginTop: 30,
        shadowColor: Colors.red,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    logoutButtonText: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 5,
    },
});