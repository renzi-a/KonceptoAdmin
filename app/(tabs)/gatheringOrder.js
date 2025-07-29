import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '../../services/api'; // Ensure this path is correct

const { width } = Dimensions.get('window');

export default function GatheringOrderScreen() {
    const navigation = useNavigation();

    const [activeTab, setActiveTab] = useState('all');
    const [activeStatus, setActiveStatus] = useState('All');
    const [orders, setOrders] = useState([]);
    const [counts, setCounts] = useState({
        allOrdersCount: 0,
        normalOrdersCount: 0,
        customOrdersCount: 0,
        completedOrdersCount: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        setRefreshing(true); // Start refreshing indicator

        try {
            const endpoint = `/api/admin/orders?tab=${activeTab}&status=${encodeURIComponent(activeStatus)}`;
            console.log('Fetching orders using apiRequest. Endpoint:', endpoint);

            const data = await apiRequest('GET', endpoint);

            console.log('Orders API Response (successful):', data);

            setOrders(data.orders);
            setCounts({
                allOrdersCount: data.allOrdersCount,
                normalOrdersCount: data.normalOrdersCount,
                customOrdersCount: data.customOrdersCount, // Use the correct count directly
                completedOrdersCount: data.completedOrdersCount,
            });
        } catch (err) {
            console.error('Error fetching orders:', err);
            if (err.response) {
                console.error('Server response for orders error:', err.response.data);
                console.error('Server status for orders error:', err.response.status);
            } else if (err.message === 'No token found') {
                setError('Authentication required. Please log in.');
            } else {
                setError(err.message || 'An unknown error occurred.');
            }
        } finally {
            setLoading(false);
            setRefreshing(false); // Stop refreshing indicator
        }
    }, [activeTab, activeStatus]); // Dependencies for useCallback

    // Fetch orders on component mount and when activeTab or activeStatus changes
    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]); // Dependency is the memoized fetchOrders function

    // Use useFocusEffect to refetch data when the screen comes into focus
    useFocusEffect(
        useCallback(() => {
            fetchOrders();
        }, [fetchOrders])
    );

    const getStatusesForTab = (tab) => {
        if (tab === 'orders') {
            return ['All', 'New', 'To be Delivered', 'Delivered'];
        } else if (tab === 'custom') {
            return ['All', 'To be Quoted', 'Quoted', 'Approved', 'Gathering', 'To be Delivered', 'Delivered'];
        } else if (tab === 'all') {
            return ['All', 'New', 'To be Quoted', 'Quoted', 'Approved', 'Gathering', 'To be Delivered', 'Delivered'];
        } else if (tab === 'completed') {
            return ['All']; // Or just 'Delivered' if you want to explicitly show only delivered
        }
        return [];
    };

    const currentStatuses = getStatusesForTab(activeTab);

    const handleViewDetails = (order) => {
        if (order.is_custom) {
            if (['to be quoted', 'quoted'].includes(order.status.toLowerCase())) {
                router.push({
                    pathname: `/order/quotation/${order.id}`,
                    params: { orderId: order.id },
                });
            } else if (['approved', 'gathering'].includes(order.status.toLowerCase())) {
                router.push({
                    pathname: `/order/gathering/${order.id}`,
                    params: { orderId: order.id },
                });
            } else if (order.status.toLowerCase() === 'to be delivered') {
                router.push({
                    pathname: `/order/delivery`,
                    params: {
                        orderId: order.id,
                        orderType: 'custom',
                    },
                });
            } else {
                // General custom order details if no specific route matches
                Alert.alert(
                    'View Details',
                    `Navigating to Custom Order Details for ID: ${order.id}\nStatus: ${order.status}`
                );
            }
        } else { // Normal orders
            if (order.status.toLowerCase() === 'to be delivered') {
                router.push({
                    pathname: `/order/delivery`,
                    params: {
                        orderId: order.id,
                        orderType: 'normal',
                    },
                });
            } else {
                // General normal order details
                router.push({
                    pathname: `/order/normal-details/${order.id}`, // Example path for normal order details
                    params: { orderId: order.id },
                });
            }
        }
    };

    const handleStartQuotation = async (orderId) => {
        console.log(`Starting quotation for Custom Order ID: ${orderId}`);
        // Navigate to the quotation screen for the specific order
        router.push(`/order/quotation/${orderId}`);
    };

    return (
        <ScrollView
            style={styles.scrollViewContainer}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={fetchOrders}
                    colors={['#10B981']} // Customize loading spinner color
                />
            }
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.headerContainer}>
                    <Text style={styles.headerTitle}>Order Management</Text>
                </View>

                {/* Tab Navigation */}
                <View style={styles.tabNavContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabList}>
                        {[
                            { key: 'all', label: 'All Pending', count: counts.allOrdersCount },
                            { key: 'orders', label: 'Orders', count: counts.normalOrdersCount },
                            { key: 'custom', label: 'Custom Orders', count: counts.customOrdersCount },
                            { key: 'completed', label: 'Completed', count: counts.completedOrdersCount },
                        ].map((tab) => (
                            <Pressable
                                key={tab.key}
                                onPress={() => {
                                    setActiveTab(tab.key);
                                    setActiveStatus('All'); // Reset status when tab changes
                                }}
                                style={[
                                    styles.tabItem,
                                    activeTab === tab.key && styles.tabItemActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.tabText,
                                        activeTab === tab.key ? styles.tabTextActive : styles.tabTextInactive,
                                    ]}
                                >
                                    {tab.label}
                                </Text>
                                <View style={styles.tabCountBadge}>
                                    <Text style={styles.tabCountText}>{tab.count}</Text>
                                </View>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>

                {/* Status Filters */}
                {currentStatuses.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusFilterContainer}>
                        {currentStatuses.map((status) => (
                            <Pressable
                                key={status}
                                onPress={() => setActiveStatus(status)}
                                style={[
                                    styles.statusButton,
                                    (activeStatus === status || (activeStatus === 'All' && status === 'All'))
                                        ? styles.statusButtonActive
                                        : styles.statusButtonInactive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.statusButtonText,
                                        (activeStatus === status || (activeStatus === 'All' && status === 'All'))
                                            ? styles.statusButtonTextActive
                                            : styles.statusButtonTextInactive,
                                    ]}
                                >
                                    {status}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                )}

                {/* Loading and Error Indicators */}
                {loading && !refreshing ? ( // Only show large indicator if not refreshing
                    <ActivityIndicator size="large" color="#10B981" style={styles.loadingIndicator} />
                ) : error ? (
                    <Text style={styles.errorText}>Error: {error}</Text>
                ) : (
                    /* Orders List */
                    <View style={styles.ordersListContainer}>
                        {orders.length > 0 ? (
                            orders.map((order) => (
                                <Pressable
                                    key={order.id}
                                    onPress={() => handleViewDetails(order)}
                                    style={[
                                        styles.orderCard,
                                        order.is_custom ? styles.orderCardCustom : styles.orderCardNormal,
                                    ]}
                                >
                                    <View style={styles.orderCardHeader}>
                                        <View style={styles.orderInfo}>
                                            <Text style={styles.orderTitle}>
                                                Order #{order.is_custom ? 'C' : ''}{order.id}
                                            </Text>
                                            <Text style={styles.orderItems}>
                                                Items: {order.is_custom ? order.items_count : (order.items?.length ?? '-')}
                                            </Text>
                                            <Text style={styles.orderUser}>
                                                {order.first_name ?? '-'} {order.last_name ?? ''}
                                                {order.school_name && ` – ${order.school_name}`}
                                            </Text>
                                        </View>

                                        <View style={styles.orderStatusActions}>
                                            <View style={styles.orderStatusBadges}>
                                                <View
                                                    style={[
                                                        styles.orderTypeBadge,
                                                        order.is_custom ? styles.orderTypeBadgeCustom : styles.orderTypeBadgeNormal,
                                                    ]}
                                                >
                                                    <Text style={styles.orderBadgeText}>
                                                        {order.is_custom ? 'Custom' : 'Normal'}
                                                    </Text>
                                                </View>
                                                <View style={styles.orderStatusBadge}>
                                                    <Text style={styles.orderBadgeText}>
                                                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                                    </Text>
                                                </View>
                                            </View>

                                            {order.is_custom && (
                                                <>
                                                    {order.status.toLowerCase() === 'to be quoted' && (
                                                        <Pressable
                                                            onPress={() => handleStartQuotation(order.id)}
                                                            style={styles.quotationButton}
                                                        >
                                                            <Text style={styles.quotationButtonText}>Start Quotation</Text>
                                                        </Pressable>
                                                    )}
                                                    {order.status.toLowerCase() === 'approved' && (
                                                        <Text style={styles.approvedText}>Approved. Awaiting gathering.</Text>
                                                    )}
                                                </>
                                            )}
                                            {/* NEW: Start Delivery Button for 'to be delivered' status */}
                                            {order.status.toLowerCase() === 'to be delivered' && (
                                                <Pressable
                                                    onPress={() => handleViewDetails(order)}
                                                    style={styles.startDeliveryButton}
                                                >
                                                    <Text style={styles.startDeliveryButtonText}>Start Delivery</Text>
                                                </Pressable>
                                            )}
                                        </View>
                                    </View>

                                    <View style={styles.orderCardFooter}>
                                        <Text style={styles.orderDate}>
                                            {new Date(order.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </Text>
                                    </View>
                                </Pressable>
                            ))
                        ) : (
                            <Text style={styles.noOrdersText}>No orders found.</Text>
                        )}
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollViewContainer: {
        flex: 1,
        backgroundColor: '#F0F4F8',
    },
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 30,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 25,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: '#2C3E50',
    },
    tabNavContainer: {
        borderBottomWidth: 1,
        borderBottomColor: '#E0E6ED',
        marginBottom: 20,
    },
    tabList: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 5,
    },
    tabItem: {
        paddingVertical: 10,
        paddingHorizontal: 15,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
        borderRadius: 8,
    },
    tabItemActive: {
        borderBottomWidth: 3,
        borderBottomColor: '#28B463',
    },
    tabText: {
        fontWeight: '600',
        fontSize: 15,
    },
    tabTextActive: {
        color: '#28B463',
    },
    tabTextInactive: {
        color: '#7F8C8D',
    },
    tabCountBadge: {
        backgroundColor: '#D1D9E0',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginLeft: 6,
    },
    tabCountText: {
        color: '#34495E',
        fontSize: 11,
        fontWeight: 'bold',
    },
    statusFilterContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 25,
        gap: 10,
        paddingVertical: 5,
    },
    statusButton: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#D1D9E0',
    },
    statusButtonActive: {
        backgroundColor: '#28B463',
        borderColor: '#28B463',
    },
    statusButtonInactive: {
        backgroundColor: '#FFFFFF',
    },
    statusButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    statusButtonTextActive: {
        color: '#FFFFFF',
    },
    statusButtonTextInactive: {
        color: '#5D6D7E',
    },
    ordersListContainer: {
        gap: 18,
    },
    orderCard: {
        borderRadius: 15,
        padding: 20,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 5,
    },
    orderCardNormal: {
        borderLeftWidth: 5,
        borderLeftColor: '#5DADE2',
    },
    orderCardCustom: {
        borderLeftWidth: 5,
        borderLeftColor: '#F7DC6F',
    },
    orderCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    orderInfo: {
        flex: 1,
        marginRight: 10,
    },
    orderTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#34495E',
        marginBottom: 5,
    },
    orderItems: {
        fontSize: 15,
        color: '#626567',
        marginBottom: 3,
    },
    orderUser: {
        fontSize: 13,
        color: '#7F8C8D',
    },
    orderStatusActions: {
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
    },
    orderStatusBadges: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 10,
    },
    orderTypeBadge: {
        borderRadius: 15,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    orderTypeBadgeNormal: {
        backgroundColor: '#EBF5FB',
    },
    orderTypeBadgeCustom: {
        backgroundColor: '#FCF3CF',
    },
    orderStatusBadge: {
        backgroundColor: '#EAECEE',
        borderRadius: 15,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    orderBadgeText: {
        fontSize: 11,
        color: '#34495E',
        fontWeight: '600',
    },
    quotationButton: {
        marginTop: 10,
        paddingHorizontal: 15,
        paddingVertical: 8,
        backgroundColor: '#28B463',
        borderRadius: 8,
        shadowColor: '#28B463',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    quotationButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    approvedText: {
        marginTop: 10,
        color: '#28B463',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'right',
    },
    startDeliveryButton: {
        marginTop: 10,
        paddingHorizontal: 15,
        paddingVertical: 8,
        backgroundColor: '#3498DB', // A different color for delivery button
        borderRadius: 8,
        shadowColor: '#3498DB',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    startDeliveryButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    loadingIndicator: {
        marginTop: 50,
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginTop: 30,
        fontSize: 16,
    },
    noOrdersText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        color: '#7F8C8D',
    },
});