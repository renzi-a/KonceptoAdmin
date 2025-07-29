// app/(tabs)/order/delivery.js

import { deliveryApiRequest } from '@/services/api';
import { Asset } from 'expo-asset'; // Import Asset from expo-asset
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
const MAP_HTML_FILE = require('../../../assets/map.html'); // Keep as require
// --- END IMPORTANT ---

export default function DeliveryScreen() {
    const { orderId, orderType } = useLocalSearchParams();

    console.log('Parameters received in DeliveryScreen:', { orderId, orderType });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [order, setOrder] = useState(null);
    const [driverLocation, setDriverLocation] = useState(null);
    const [destinationLocation, setDestinationLocation] = useState(null);
    const [mapHtmlUri, setMapHtmlUri] = useState(null); // New state for the HTML file URI
    const locationSubscription = useRef(null);
    const webViewRef = useRef(null);

    // Function to load the local HTML asset
    const loadHtmlAsset = async () => {
        try {
            const asset = Asset.fromModule(MAP_HTML_FILE);
            if (!asset.localUri) {
                // Ensure the asset is loaded and localUri is available
                await asset.downloadAsync();
            }
            console.log('MAP_HTML_FILE URI for WebView:', asset.localUri);
            setMapHtmlUri(asset.localUri);
        } catch (err) {
            console.error('Error loading HTML asset:', err);
            setError('Failed to load map file.');
        }
    };

    const fetchOrderDetails = useCallback(async () => {
        try {
            const response = await deliveryApiRequest('get', `/delivery.php?orderId=${orderId}&orderType=${orderType}`);
            console.log("✅ Raw delivery API response:", response);

            if (response && response.order) {
                setOrder(response.order);

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
                console.warn("⚠️ No order returned in response");
                setError('Order details could not be retrieved. Order may not exist or server error.');
                setOrder(null);
            }
        } catch (err) {
            console.error('Error fetching order details:', err);
            setError(`Failed to load order details: ${err.message || 'Unknown error'}. Check server connection.`);
        } finally {
            // Only set loading to false after both order details and HTML asset are ready
            // We'll manage this in a combined effect/logic.
        }
    }, [orderId, orderType]);

    useEffect(() => {
        const init = async () => {
            if (orderId && orderType) {
                setLoading(true); // Start loading
                await loadHtmlAsset(); // Load HTML asset first
                await fetchOrderDetails(); // Then fetch order details
                startLocationTracking();
                setLoading(false); // End loading
            } else {
                setError('Order ID or Type is missing.');
                setLoading(false);
            }
        };
        init();

        return () => {
            if (locationSubscription.current) {
                locationSubscription.current.remove();
            }
        };
    }, [orderId, orderType, fetchOrderDetails]); // Include fetchOrderDetails in deps

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
                    accuracy: location.coords.accuracy,
                };
                setDriverLocation(newLocation);
                sendDriverLocationToServer(newLocation.latitude, newLocation.longitude);

                if (webViewRef.current && destinationLocation) {
                    const message = JSON.stringify({
                        type: 'UPDATE_MAP',
                        payload: {
                            driverLocation: { latitude: newLocation.latitude, longitude: newLocation.longitude, accuracy: newLocation.accuracy },
                            destinationLocation: destinationLocation,
                        },
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

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance * 1000;
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
                            fetchOrderDetails();
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

        const deliveryThresholdMeters = 50;

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
        if (data.type === 'MAP_READY') {
            console.log("RN: WebView reported MAP_READY.");
            if (driverLocation && destinationLocation) {
                const message = JSON.stringify({
                    type: 'UPDATE_MAP',
                    payload: {
                        driverLocation: { latitude: driverLocation.latitude, longitude: driverLocation.longitude, accuracy: driverLocation.accuracy || 0 },
                        destinationLocation: destinationLocation,
                    },
                });
                webViewRef.current.postMessage(message);
                console.log("RN: Sent initial map update to WebView.");
            } else {
                console.warn("RN: MAP_READY received, but driver/destination location not yet available for initial update.");
            }
        }
    };

    if (loading || !mapHtmlUri) { // Added !mapHtmlUri to loading check
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>Loading map and order details...</Text>
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
                {mapHtmlUri && ( // Render WebView only when mapHtmlUri is available
                    <WebView
                        ref={webViewRef}
                        originWhitelist={['*']}
                        source={{ uri: mapHtmlUri }} // Use the dynamically loaded file URI
                        style={styles.mapWebView}
                        onMessage={handleWebViewMessage}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        allowFileAccess={true}
                        allowUniversalAccessFromFileURLs={true}
                        onLoad={(syntheticEvent) => {
                            const { nativeEvent } = syntheticEvent;
                            console.log('WebView onLoad: URL:', nativeEvent.url, 'Loading:', nativeEvent.loading);
                            if (nativeEvent.url && !nativeEvent.url.startsWith('file://')) {
                                console.warn("WebView loaded an unexpected URL. Expected a 'file://' URL for local HTML. Got:", nativeEvent.url);
                            }
                        }}
                        onError={(syntheticEvent) => {
                            const { nativeEvent } = syntheticEvent;
                            console.error('WebView onError:', nativeEvent);
                            Alert.alert('Map Load Error', `Failed to load map: ${nativeEvent.description || 'Unknown WebView Error'}. Check console for details.`);
                        }}
                    />
                )}
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
                {order.status === 'delivering' && (
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
        backgroundColor: '#f8f8f8',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#555',
    },
    errorText: {
        fontSize: 16,
        color: '#D9534F',
        textAlign: 'center',
        marginBottom: 20,
    },
    noOrderText: {
        fontSize: 16,
        color: '#555',
        textAlign: 'center',
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingTop: 50,
    },
    backButton: {
        padding: 10,
    },
    backButtonText: {
        fontSize: 16,
        color: '#007AFF',
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginRight: 40,
    },
    infoCard: {
        backgroundColor: '#fff',
        margin: 15,
        padding: 15,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
        elevation: 2,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#333',
    },
    infoText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 3,
    },
    mapContainer: {
        flex: 1,
        backgroundColor: '#e0e0e0',
        marginHorizontal: 15,
        marginBottom: 15,
        borderRadius: 8,
        overflow: 'hidden',
    },
    mapWebView: {
        flex: 1,
    },
    locationDebug: {
        backgroundColor: '#f0f0f0',
        padding: 10,
        marginHorizontal: 15,
        borderRadius: 8,
        marginBottom: 15,
    },
    locationDebugText: {
        fontSize: 12,
        color: '#555',
    },
    actionsContainer: {
        padding: 15,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    actionButton: {
        backgroundColor: '#10B981',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 150,
    },
    startButton: {
        backgroundColor: '#007AFF',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});