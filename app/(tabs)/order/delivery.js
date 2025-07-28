import { apiRequest } from '@/services/api';
import * as Location from 'expo-location'; // Import expo-location
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import WebView from 'react-native-webview'; // If you're using a local HTML map
 // Adjust path if necessary based on your file structure

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const BASE_URL = 'http://192.168.1.2:8000/api'; // Make sure this is correct

export default function DeliveryScreen() {
    const { orderId, orderType } = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [order, setOrder] = useState(null);
    const [driverLocation, setDriverLocation] = useState(null);
    const [destinationLocation, setDestinationLocation] = useState(null);
    const locationSubscription = useRef(null);
    const mapRef = useRef(null); // Ref for MapView if you're using it

    // State for WebView (if using HTML map)
    const webViewRef = useRef(null);
    const [mapHtmlContent, setMapHtmlContent] = useState('');

    useEffect(() => {
        // Load the map.html content
        async function loadMapHtml() {
            try {
                // Adjust the path to your map.html file
                const htmlPath = Platform.OS === 'android' ? 'file:///android_asset/map.html' : './assets/map.html';
                const response = await fetch(htmlPath);
                const html = await response.text();
                setMapHtmlContent(html);
            } catch (e) {
                console.error('Failed to load map.html:', e);
                setError('Failed to load map resources.');
            }
        }
        loadMapHtml();
    }, []);

    useEffect(() => {
        const fetchOrderDetails = async () => {
            try {
                const endpoint = orderType === 'custom' ? `/admin/custom-orders/${orderId}` : `/admin/orders/${orderId}`;
                const response = await apiRequest.get(endpoint); // Assuming apiRequest.get is set up
                setOrder(response.data.order);
                if (response.data.order.delivery_location) {
                    setDestinationLocation({
                        latitude: parseFloat(response.data.order.delivery_location.latitude),
                        longitude: parseFloat(response.data.order.delivery_location.longitude),
                    });
                }
            } catch (err) {
                console.error('Error fetching order details:', err);
                setError('Failed to load order details.');
            } finally {
                setLoading(false);
            }
        };

        fetchOrderDetails();

        // Start location tracking
        startLocationTracking();

        return () => {
            // Cleanup: Unsubscribe from location updates
            if (locationSubscription.current) {
                locationSubscription.current.remove();
            }
        };
    }, [orderId, orderType]);

    const startLocationTracking = async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Permission to access location was denied. Cannot track driver location.');
            setError('Location permission denied.');
            return;
        }

        locationSubscription.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 5000, // Update every 5 seconds
                distanceInterval: 10, // Update if moved by 10 meters
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
                
                // If using WebView, send location to HTML map
                if (webViewRef.current && destinationLocation) {
                    const message = JSON.stringify({
                        type: 'updateLocation',
                        driver: newLocation,
                        destination: destinationLocation,
                    });
                    webViewRef.current.postMessage(message);
                }
            }
        );
    };

    const sendDriverLocationToServer = async (latitude, longitude) => {
        try {
            await apiRequest.post(`${BASE_URL}/admin/delivery/${orderId}/update-location`, {
                latitude,
                longitude,
            });
            console.log('Driver location sent to server successfully.');
        } catch (err) {
            console.error('Failed to send driver location to server:', err);
            // You might want to handle this error more gracefully, e.g., show a toast
        }
    };

    const handleWebViewMessage = (event) => {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'mapReady') {
            // Map is ready, send initial driver and destination locations
            if (driverLocation && destinationLocation) {
                const message = JSON.stringify({
                    type: 'updateLocation',
                    driver: driverLocation,
                    destination: destinationLocation,
                });
                webViewRef.current.postMessage(message);
            }
        }
        // Handle other messages from the WebView if needed
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
                <Text style={styles.noOrderText}>Order not found.</Text>
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
                <Text style={styles.infoTitle}>Customer: {order.user?.first_name} {order.user?.last_name}</Text>
                <Text style={styles.infoText}>Status: {order.status.charAt(0).toUpperCase() + order.status.slice(1)}</Text>
                {/* Display other relevant order details */}
                <Text style={styles.infoText}>Delivery Address: {order.delivery_location?.address || 'N/A'}</Text>
            </View>

            {/* Map Section */}
            {mapHtmlContent ? (
                <View style={styles.mapContainer}>
                    <WebView
                        ref={webViewRef}
                        originWhitelist={['*']}
                        source={{ html: mapHtmlContent }}
                        style={styles.mapWebView}
                        onMessage={handleWebViewMessage}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        allowFileAccess={true}
                        allowUniversalAccessFromFileURLs={true}
                    />
                </View>
            ) : (
                <View style={styles.mapContainer}>
                    <Text style={styles.mapPlaceholderText}>Loading map...</Text>
                </View>
            )}

            {driverLocation && (
                <View style={styles.locationDebug}>
                    <Text style={styles.locationDebugText}>Driver Lat: {driverLocation.latitude.toFixed(6)}</Text>
                    <Text style={styles.locationDebugText}>Driver Lng: {driverLocation.longitude.toFixed(6)}</Text>
                </View>
            )}

            <View style={styles.actionsContainer}>
                <Pressable style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>Mark as Delivered</Text>
                </Pressable>
                {/* Add other actions like 'Call Customer' etc. */}
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
        backgroundColor: '#EAECEE', // Placeholder background
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
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});