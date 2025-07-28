import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { apiRequest } from '../../../services/api';

const roleLabelMap = {
    school_admin: 'SOA',
    teacher: 'Teacher',
    student: 'Student',
};

const tabs = [
    { key: 'all', label: 'ALL' },
    { key: 'school_admin', label: 'SAO' },
    { key: 'teacher', label: 'TEACHER' },
    { key: 'student', label: 'STUDENT' },
];

export default function UsersScreen() {
    const navigation = useNavigation();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await apiRequest('get', '/api/admin/chat/users');
                setUsers(response);
            } catch (err) {
                console.error('Error fetching users:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    const filteredUsers = users.filter((user) => {
        const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
        const email = user.email.toLowerCase();
        const matchesSearch =
            fullName.includes(search.toLowerCase()) ||
            email.includes(search.toLowerCase());

        const matchesRole =
            activeTab === 'all' ? true : user.role === activeTab;

        return matchesSearch && matchesRole;
    });

    const renderUserCard = ({ item }) => (
        <TouchableOpacity
            style={styles.userCard}
            onPress={() => {
                // navigation.navigate('UserDetails', { userId: item.id });
                console.log('User card pressed:', item.first_name);
            }}
        >
            <View style={styles.userInfo}>
                <MaterialIcons
                    name="person"
                    size={24}
                    color="#4CAF50"
                    style={styles.userIcon}
                />
                <View style={styles.userNameEmailContainer}>
                    <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
                        {item.first_name} {item.last_name}
                    </Text>
                    <Text style={styles.userEmail} numberOfLines={1} ellipsizeMode="tail">
                        {item.email}
                    </Text>
                </View>
            </View>
            <View style={styles.userRoleContainer}>
                <MaterialCommunityIcons
                    name="account-tie"
                    size={16} // Slightly smaller icon for role
                    color="#666"
                />
                <Text style={styles.userRole} numberOfLines={1} ellipsizeMode="tail">
                    {roleLabelMap[item.role] || item.role}
                </Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={28} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>User Management</Text>
                <View style={styles.rightHeaderPlaceholder} />
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                {tabs.map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[
                            styles.tabButton,
                            activeTab === tab.key && styles.activeTab,
                        ]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === tab.key && styles.activeTabText,
                            ]}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Search Input */}
            <View style={styles.searchInputContainer}>
                <MaterialIcons
                    name="search"
                    size={20}
                    color="#888"
                    style={styles.searchIcon}
                />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or email"
                    placeholderTextColor="#888"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {/* User List */}
            {loading ? (
                <ActivityIndicator
                    size="large"
                    color="#4CAF50"
                    style={styles.activityIndicator}
                />
            ) : (
                <FlatList
                    data={filteredUsers}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderUserCard}
                    contentContainerStyle={styles.flatListContent}
                    ListEmptyComponent={() => (
                        <Text style={styles.emptyListText}>No users found.</Text>
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
        marginLeft: -38,
    },
    rightHeaderPlaceholder: {
        width: 38,
        height: 38,
    },
    tabsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        backgroundColor: '#E0E0E0',
        borderRadius: 25,
        padding: 5,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeTab: {
        backgroundColor: '#4CAF50',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 4,
    },
    tabText: {
        color: '#555',
        fontWeight: '600',
        fontSize: 14,
    },
    activeTabText: {
        color: '#fff',
        fontWeight: '700',
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingHorizontal: 15,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        height: 50,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    activityIndicator: {
        marginTop: 50,
    },
    flatListContent: {
        paddingBottom: 20,
    },
    userCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 15,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1, // Allow userInfo to take available space
        marginRight: 10, // Add some space between user info and role
    },
    userIcon: {
        marginRight: 15,
    },
    userNameEmailContainer: {
        flex: 1, // Crucial: allows text to flex and wrap within this container
        justifyContent: 'center',
    },
    userName: {
        fontSize: 17, // Slightly smaller font for names
        fontWeight: '600',
        color: '#333',
    },
    userEmail: {
        fontSize: 13, // Slightly smaller for emails
        color: '#666',
        marginTop: 2,
    },
    userRoleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        // Ensure this container doesn't shrink unnecessarily, but also allows content to truncate
        flexShrink: 0,
        maxWidth: '40%', // Adjust as needed based on common role lengths
    },
    userRole: {
        fontSize: 12, // Smaller font for role
        color: '#2E7D32',
        fontWeight: 'bold',
        marginLeft: 5,
    },
    emptyListText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        color: '#888',
    },
});