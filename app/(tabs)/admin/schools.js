import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons'; // Import icons
import { useNavigation } from '@react-navigation/native'; // For the back button
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { apiRequest } from '../../../services/api';

export default function SchoolsScreen() {
    const navigation = useNavigation();
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null); // State for error handling

    useEffect(() => {
        const fetchSchools = async () => {
            try {
                const response = await apiRequest('get', '/api/admin/schools');
                // Ensure each item has an 'id'. If not, filter it out or assign a temporary key.
                const validSchools = response.filter(item => item && item.id !== undefined && item.id !== null);
                setSchools(validSchools);
            } catch (err) {
                console.error('Failed to fetch schools:', err);
                setError('Failed to load schools. Please try again later.'); // Set user-friendly error message
            } finally {
                setLoading(false);
            }
        };

        fetchSchools();
    }, []);

    const renderSchool = ({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => {
            // Handle school card press, e.g., navigate to school details
            console.log('School card pressed:', item.school_name);
            // Example: navigation.navigate('SchoolDetails', { schoolId: item.id });
        }}>
            <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="office-building" size={28} color="#007BFF" style={styles.schoolIcon} />
                <View style={styles.schoolNameContainer}>
                    <Text style={styles.schoolName}>{item.school_name}</Text>
                    <Text style={styles.schoolEmail}>{item.school_email}</Text>
                </View>
            </View>

            <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                    <MaterialIcons name="location-on" size={16} color="#666" style={styles.infoIcon} />
                    <Text style={styles.schoolAddress}>{item.address}</Text>
                </View>

                <View style={styles.countsContainer}>
                    <View style={styles.countItem}>
                        <MaterialIcons name="group" size={16} color="#4CAF50" style={styles.countIcon} />
                        <Text style={styles.countText}>Users: {item.users_count}</Text>
                    </View>
                    <View style={styles.countItem}>
                        <MaterialIcons name="admin-panel-settings" size={16} color="#F44336" style={styles.countIcon} />
                        <Text style={styles.countText}>Admins: {item.admin_count}</Text>
                    </View>
                    <View style={styles.countItem}>
                        <MaterialIcons name="school" size={16} color="#FFC107" style={styles.countIcon} />
                        <Text style={styles.countText}>Teachers: {item.teacher_count}</Text>
                    </View>
                    <View style={styles.countItem}>
                        <MaterialIcons name="person" size={16} color="#2196F3" style={styles.countIcon} />
                        <Text style={styles.countText}>Students: {item.student_count}</Text>
                    </View>
                    <View style={styles.countItem}>
                        <MaterialIcons name="shopping-cart" size={16} color="#9C27B0" style={styles.countIcon} />
                        <Text style={styles.countText}>Orders: {item.orders_count}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={28} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>Schools</Text>
                <View style={styles.rightHeaderPlaceholder} />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#007BFF" style={styles.activityIndicator} />
            ) : error ? (
                <Text style={styles.errorText}>{error}</Text>
            ) : (
                <FlatList
                    data={schools}
                    keyExtractor={(item, index) => item.id ? item.id.toString() : `school-${index}`}
                    renderItem={renderSchool}
                    contentContainerStyle={styles.flatListContent}
                    ListEmptyComponent={() => (
                        <Text style={styles.emptyListText}>No schools found.</Text>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#F5F8FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        marginTop: 10,
    },
    backButton: {
        padding: 5,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#333',
        flex: 1,
        textAlign: 'center',
        marginLeft: -38, // Counteract back button width for centering
    },
    rightHeaderPlaceholder: {
        width: 38,
        height: 38,
    },
    activityIndicator: {
        marginTop: 50,
    },
    errorText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        color: '#D32F2F', // Red color for errors
    },
    flatListContent: {
        paddingBottom: 20,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 }, // Increased shadow for more depth
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 5,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        borderBottomWidth: 1, // Separator
        borderBottomColor: '#EEE',
        paddingBottom: 10,
    },
    schoolIcon: {
        marginRight: 15,
    },
    schoolNameContainer: {
        flex: 1, // Allow text to take space
    },
    schoolName: {
        fontSize: 19, // Slightly larger
        fontWeight: '700',
        color: '#333',
    },
    schoolEmail: {
        fontSize: 14,
        color: '#555',
        marginTop: 2,
    },
    cardBody: {
        marginTop: 10,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoIcon: {
        marginRight: 8,
    },
    schoolAddress: {
        fontSize: 14,
        color: '#666',
        flexShrink: 1, // Allows address to wrap
    },
    countsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap', // Allow counts to wrap to next line
        justifyContent: 'space-between', // Distribute items
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1, // Separator
        borderTopColor: '#EEE',
    },
    countItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
        width: '48%', // Roughly half width to allow 2 items per row
    },
    countIcon: {
        marginRight: 5,
    },
    countText: {
        fontSize: 13,
        color: '#444',
        fontWeight: '500', // Slightly bolder
    },
    emptyListText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        color: '#888',
    },
});