// app/(tabs)/order/delivery.js

import { deliveryApiRequest } from '@/services/api'; // Correct import for delivery-specific API
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import WebView from 'react-native-webview';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

// --- IMPORTANT: This path is confirmed correct for KonceptoAdmin/assets/map.html ---
// Assuming your project root is 'KonceptoAdmin'
// From 'app/(tabs)/order/delivery.js' up three levels to 'KonceptoAdmin/', then into 'assets/'
const MAP_HTML_SOURCE = require('../../../assets/map.html');
// --- END IMPORTANT ---

export default function DeliveryScreen() {
    const { orderId, orderType } = useLocalSearchParams();

    // >>> THIS IS THE CONSOLE.LOG YOU SHOULD CHECK <<<
    console.log('Parameters received in DeliveryScreen:', { orderId, orderType });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [order, setOrder] = useState(null);
    const [driverLocation, setDriverLocation] = useState(null);
    const [destinationLocation, setDestinationLocation] = useState(null);
    const locationSubscription = useRef(null);
    const webViewRef = useRef(null);

    const fetchOrderDetails = useCallback(async () => {
        try {
            const response = await deliveryApiRequest('get', `/delivery.php?orderId=${orderId}&orderType=${orderType}`);
            
            // Check if response and response.order are valid before setting state
            if (response && response.order) {
                setOrder(response.order);

                // Safely access delivery_location with optional chaining
                if (response.order.delivery_location) {
                    const { latitude, longitude } = response.order.delivery_location;
                    if (latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude))) {
                        setDestinationLocation({
                            latitude: parseFloat(latitude),
                            longitude: parseFloat(longitude),
                        });
                    } else {
                        console.warn('Invalid delivery_location data:', response.order.delivery_location);
                        setError('Invalid delivery location data for this order.');
                    }
                } else {
                    setError('Delivery location not found for this order.');
                }
            } else {
                setError('Order details could not be retrieved. Order may not exist or server error.');
                setOrder(null); // Ensure order is null if fetch failed
            }
        } catch (err) {
            console.error('Error fetching order details:', err);
            setError(`Failed to load order details: ${err.message || 'Unknown error'}. Check server connection.`);
        } finally {
            setLoading(false);
        }
    }, [orderId, orderType]);

    useEffect(() => {
        if (orderId && orderType) {
            fetchOrderDetails();
            startLocationTracking();
        } else {
            setError('Order ID or Type is missing.');
            setLoading(false);
        }

        return () => {
            if (locationSubscription.current) {
                locationSubscription.current.remove();
            }
        };
    }, [orderId, orderType, fetchOrderDetails]);

    const startLocationTracking = async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Permission to access location was denied.');
            setError('Location permission denied.');
            return;
        }

        locationSubscription.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 5000,
                distanceInterval: 10,
            },
            (location) => {
                const newLocation = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: LATITUDE_DELTA,
                    longitudeDelta: LONGITUDE_DELTA,
                };
                setDriverLocation(newLocation);
                sendDriverLocationToServer(newLocation.latitude, newLocation.longitude);

                if (webViewRef.current && destinationLocation) {
                    const message = JSON.stringify({
                        type: 'updateLocation',
                        driver: { latitude: newLocation.latitude, longitude: newLocation.longitude },
                        destination: destinationLocation,
                    });
                    webViewRef.current.postMessage(message);
                }
            }
        );
    };

    const sendDriverLocationToServer = async (latitude, longitude) => {
        try {
            await deliveryApiRequest('post', `/delivery.php?action=update-location&orderId=${orderId}&orderType=${orderType}`, {
                latitude,
                longitude,
            });
            console.log('Driver location sent to server successfully.');
        } catch (err) {
            console.error('Failed to send driver location:', err);
        }
    };

    // Helper function to calculate distance between two lat/lng points (Haversine formula)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Radius of Earth in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c; // Distance in km
        return distance * 1000; // Return distance in meters
    };

    const handleStartDelivery = async () => {
        if (!orderId || !orderType) {
            Alert.alert('Error', 'Order ID or Type missing. Cannot start delivery.');
            return;
        }
        Alert.alert(
            'Confirm Start Delivery',
            'Are you sure you want to start this delivery?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Yes',
                    onPress: async () => {
                        try {
                            await deliveryApiRequest('post', `/delivery.php?action=update-status&orderId=${orderId}&orderType=${orderType}`, {
                                status: 'delivering',
                            });
                            Alert.alert('Success', 'Order status updated to "Delivering".');
                            fetchOrderDetails(); // Re-fetch to update local state
                        } catch (err) {
                            console.error('Failed to start delivery:', err);
                            Alert.alert('Error', 'Failed to update status to "Delivering". Please try again.');
                        }
                    },
                },
            ]
        );
    };

    const handleMarkAsDelivered = async () => {
        if (!driverLocation || !destinationLocation) {
            Alert.alert('Error', 'Cannot mark as delivered. Driver location or destination missing.');
            return;
        }
        if (!orderId || !orderType) {
            Alert.alert('Error', 'Order ID or Type missing. Cannot mark as delivered.');
            return;
        }

        const distance = calculateDistance(
            driverLocation.latitude,
            driverLocation.longitude,
            destinationLocation.latitude,
            destinationLocation.longitude
        );

        const deliveryThresholdMeters = 50; // Example: within 50 meters of the destination

        if (distance <= deliveryThresholdMeters) {
            Alert.alert(
                'Confirm Delivery',
                'Are you sure you want to mark this order as delivered?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Yes',
                        onPress: async () => {
                            try {
                                await deliveryApiRequest('post', `/delivery.php?action=update-status&orderId=${orderId}&orderType=${orderType}`, {
                                    status: 'delivered',
                                });
                                Alert.alert('Success', 'Order marked as Delivered!');
                                // You might want to navigate back or to another screen here
                                router.back();
                            } catch (err) {
                                console.error('Failed to mark as delivered:', err);
                                Alert.alert('Error', 'Failed to mark order as delivered. Please try again.');
                            }
                        },
                    },
                ]
            );
        } else {
            Alert.alert(
                'Location Mismatch',
                `You are ${distance.toFixed(0)} meters away from the delivery location. You must be within ${deliveryThresholdMeters} meters to mark as delivered.`,
                [{ text: 'OK' }]
            );
        }
    };

    const handleWebViewMessage = (event) => {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'mapReady') {
            if (driverLocation && destinationLocation) {
                const message = JSON.stringify({
                    type: 'updateLocation',
                    driver: { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                    destination: destinationLocation,
                });
                webViewRef.current.postMessage(message);
            }
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>Loading order details...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </Pressable>
            </View>
        );
    }

    if (!order) {
        return (
            <View style={styles.centered}>
                <Text style={styles.noOrderText}>Order not found or could not be loaded.</Text>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>&larr; Back</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Delivery for Order #{order.id}</Text>
            </View>

            <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Customer: {order.user?.first_name || 'N/A'} {order.user?.last_name || 'N/A'}</Text>
                <Text style={styles.infoText}>Status: {order.status ? (order.status.charAt(0).toUpperCase() + order.status.slice(1)) : 'N/A'}</Text>
                <Text style={styles.infoText}>Delivery Address: {order.delivery_location?.address || 'N/A'}</Text>
            </View>

            <View style={styles.mapContainer}>
                <WebView
                    ref={webViewRef}
                    originWhitelist={['*']}
                    source={MAP_HTML_SOURCE} // Use the required HTML file
                    style={styles.mapWebView}
                    onMessage={handleWebViewMessage}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    allowFileAccess={true}
                    allowUniversalAccessFromFileURLs={true}
                />
            </View>

            {driverLocation && (
                <View style={styles.locationDebug}>
                    <Text style={styles.locationDebugText}>Driver Lat: {driverLocation.latitude.toFixed(6)}</Text>
                    <Text style={styles.locationDebugText}>Driver Lng: {driverLocation.longitude.toFixed(6)}</Text>
                    {destinationLocation && (
                        <Text style={styles.locationDebugText}>
                            Distance to dest: {calculateDistance(driverLocation.latitude, driverLocation.longitude, destinationLocation.latitude, destinationLocation.longitude).toFixed(0)} meters
                        </Text>
                    )}
                </View>
            )}

            <View style={styles.actionsContainer}>
                {order.status !== 'delivering' && order.status !== 'delivered' && (
                    <Pressable style={[styles.actionButton, styles.startButton]} onPress={handleStartDelivery}>
                        <Text style={styles.actionButtonText}>Start Delivery</Text>
                    </Pressable>
                )}
                {order.status === 'delivering' && ( // Only show "Mark Delivered" if status is 'delivering'
                    <Pressable style={styles.actionButton} onPress={handleMarkAsDelivered}>
                        <Text style={styles.actionButtonText}>Mark as Delivered</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F4F8',
        padding: 20,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F0F4F8',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#5D6D7E',
    },
    errorText: {
        fontSize: 16,
        color: '#E74C3C',
        textAlign: 'center',
        marginBottom: 20,
    },
    noOrderText: {
        fontSize: 16,
        color: '#85929E',
        textAlign: 'center',
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 25,
    },
    backButton: {
        marginRight: 15,
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#E0E6ED',
    },
    backButtonText: {
        fontSize: 16,
        color: '#34495E',
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#2C3E50',
    },
    infoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 5,
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#34495E',
        marginBottom: 10,
    },
    infoText: {
        fontSize: 16,
        color: '#5D6D7E',
        marginBottom: 5,
    },
    mapContainer: {
        flex: 1,
        borderRadius: 15,
        overflow: 'hidden',
        marginBottom: 20,
        backgroundColor: '#EAECEE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapWebView: {
        width: '100%',
        height: '100%',
    },
    mapPlaceholderText: {
        color: '#85929E',
        fontSize: 16,
    },
    locationDebug: {
        padding: 10,
        backgroundColor: '#EBF5FB',
        borderRadius: 10,
        marginBottom: 20,
    },
    locationDebugText: {
        fontSize: 14,
        color: '#34495E',
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 10,
    },
    actionButton: {
        backgroundColor: '#28B463',
        paddingVertical: 15,
        paddingHorizontal: 25,
        borderRadius: 10,
        shadowColor: '#28B463',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    startButton: {
        backgroundColor: '#007bff', // A different color for 'Start Delivery'
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});