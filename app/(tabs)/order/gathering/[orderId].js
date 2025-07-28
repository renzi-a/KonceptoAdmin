import { apiRequest } from '@/services/api';
import Checkbox from 'expo-checkbox';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// Assuming you have a separate constants file for these
// For this example, I'll define them here for clarity
const BASE_STORAGE_URL = 'http://kocenpto.test';

const Colors = {
  primaryGreen: '#22c55e',
  primaryBlue: '#3b82f6',
  indigo: '#6366F1',
  darkText: '#1f2937',
  mediumGrey: '#6b7280',
  lightGrey: '#e5e7eb',
  white: '#FFFFFF',
  red: '#EF4444',
  lightBackground: '#f3f4f6',
  cardBackground: '#FFFFFF',
  borderColor: '#e5e7eb',
  greenLight: '#dcfce7',
  greenBorder: '#a7f3d0',
  blueLight: '#eff6ff',
  blueBorder: '#bfdbfe',
};

export default function GatheringOrderScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); // New state for status update loading

  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const scrollY = useRef(new Animated.Value(0)).current;

  const HEADER_MAX_HEIGHT = 300;
  const HEADER_MIN_HEIGHT = 160;

  const schoolInfoHeight = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [130, 0],
    extrapolate: 'clamp',
  });

  const schoolInfoOpacity = scrollY.interpolate({
    inputRange: [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT) / 2, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  const fetchOrderDetails = async () => {
    try {
      if (!orderId) {
        console.warn('Order ID is undefined. Cannot fetch details.');
        setLoading(false);
        return;
      }
      const response = await apiRequest('get', `/api/admin/custom-orders/${orderId}/details`);
      setOrder(response.order);
      setItems(response.items);
    } catch (err) {
      console.error('API Error fetching order details:', err);
      Alert.alert('Error', 'Failed to load order details. Please check your network connection or try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (newStatus) => {
    setIsUpdatingStatus(true);
    try {
      await apiRequest('post', '/api/admin/update-order-status', {
        order_id: order.id,
        status: newStatus,
        type: 'custom',
      });
      setOrder((prevOrder) => ({ ...prevOrder, status: newStatus }));
      console.log(`Order status updated to: ${newStatus}`);
      Alert.alert('Success', `Order status updated to "${newStatus}".`);
    } catch (error) {
      console.error('API Error updating order status:', error);
      Alert.alert('Error', `Failed to update order status to "${newStatus}". Please try again.`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const toggleGathered = async (itemId, currentValue) => {
    // Optimistic update
    const updatedItems = items.map((item) =>
      item.id === itemId ? { ...item, gathered: !currentValue } : item
    );
    setItems(updatedItems);

    try {
      await apiRequest('post', `/api/admin/custom-order-items/${itemId}/toggle-gathered`, {
        gathered: !currentValue,
      });

      // After successful toggle, re-evaluate if all items are gathered
      const newGatheredCount = updatedItems.filter((item) => item.gathered).length;
      if (newGatheredCount === updatedItems.length) {
        // All items are gathered, update order status to 'to be delivered'
        if (order?.status !== 'to be delivered') { // Prevent unnecessary calls
          await updateOrderStatus('to be delivered');
        }
      } else if (order?.status === 'to be delivered' && newGatheredCount < updatedItems.length) {
        // If an item is ungathered and status was 'to be delivered', revert to 'gathering'
        await updateOrderStatus('gathering');
      }

    } catch (error) {
      console.error('API Error toggling gathered status:', error);
      Alert.alert('Error', 'Failed to update gathered status. Please try again.');
      // Revert optimistic update on error
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, gathered: currentValue } : item
        )
      );
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    } else {
      setLoading(false);
      Alert.alert('Error', 'No order ID provided for gathering details.');
    }
  }, [orderId]);

  const filteredItems = useMemo(() => {
    let currentItems = items;

    if (searchText) {
      const lowercasedSearchText = searchText.toLowerCase();
      currentItems = currentItems.filter(
        (item) =>
          item.name.toLowerCase().includes(lowercasedSearchText) ||
          (item.brand && item.brand.toLowerCase().includes(lowercasedSearchText)) ||
          (item.description && item.description.toLowerCase().includes(lowercasedSearchText))
      );
    }

    if (filterStatus === 'gathered') {
      currentItems = currentItems.filter((item) => item.gathered);
    } else if (filterStatus === 'notGathered') {
      currentItems = currentItems.filter((item) => !item.gathered);
    }

    return currentItems;
  }, [items, searchText, filterStatus]);

  const displayedItems = useMemo(() => {
    return filteredItems;
  }, [filteredItems]);

  const allItemsCount = items.length;
  const gatheredCount = items.filter((item) => item.gathered).length;
  const notGatheredCount = items.filter((item) => !item.gathered).length;

  // Function to handle saving/confirming the gathering process
  const handleSaveGathering = async () => {
    setShowConfirmModal(false); // Close the modal immediately

    // Check if all items are gathered before setting status
    if (gatheredCount === allItemsCount && allItemsCount > 0) {
      await updateOrderStatus('to be delivered');
      Alert.alert('Saved!', 'All items gathered. Order status updated to "To be Delivered" and gathering info has been saved successfully.', [{ text: 'OK', onPress: () => router.back() }]);
    } else {
      Alert.alert('Saved!', 'Gathering info has been updated successfully.', [{ text: 'OK', onPress: () => router.back() }]);
    }
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.indigo} />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundTitle}>Order Not Found</Text>
        <Text style={styles.notFoundMessage}>
          The requested order could not be loaded. It might not exist or there was an issue retrieving it. Please check the order ID.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Go Back to Orders</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View
        style={[
          styles.headerContainer,
          {
            // You can optionally animate the overall header height
          }
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>
            {`Order #${order?.id} Gathering`}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButtonHeader}
          >
            <Text style={styles.backButtonHeaderText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.gatheredCountContainer}>
          <Text style={styles.gatheredCountText}>
            Gathered: <Text style={styles.gatheredCountHighlight}>{gatheredCount}</Text> of <Text style={styles.totalItemsCount}>{allItemsCount}</Text> items
          </Text>
        </View>

        <Animated.View style={[styles.schoolInfoCard, { height: schoolInfoHeight, opacity: schoolInfoOpacity }]}>
          {order?.user?.school?.image ? (
            <Image
              source={{ uri: `${BASE_STORAGE_URL}/storage/logos/${order.user.school.image}` }}
              style={styles.schoolImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noLogoPlaceholder}>
              <Text style={styles.noLogoText}>No Logo</Text>
            </View>
          )}

          <View style={styles.schoolDetails}>
            <Text style={styles.schoolDetailText}>
              <Text style={styles.schoolDetailLabel}>School: </Text>
              {order?.user?.school?.school_name || 'N/A'}
            </Text>
            <Text style={styles.schoolDetailText}>
              <Text style={styles.schoolDetailLabel}>Admin: </Text>
              {`${order?.user?.first_name} ${order?.user?.last_name}`}
            </Text>
          </View>
        </Animated.View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search items (name, brand, description)..."
          placeholderTextColor={Colors.mediumGrey}
          value={searchText}
          onChangeText={setSearchText}
        />

        <View style={styles.filterTabsContainer}>
          <Pressable
            style={[styles.filterTabButton, filterStatus === 'all' && styles.filterTabButtonActive]}
            onPress={() => setFilterStatus('all')}
          >
            <Text style={[styles.filterTabText, filterStatus === 'all' && styles.filterTabTextActive]}>All ({allItemsCount})</Text>
          </Pressable>
          <Pressable
            style={[styles.filterTabButton, styles.filterTabButtonMargin, filterStatus === 'gathered' && styles.filterTabButtonActive]}
            onPress={() => setFilterStatus('gathered')}
          >
            <Text style={[styles.filterTabText, filterStatus === 'gathered' && styles.filterTabTextActive]}>Gathered ({gatheredCount})</Text>
          </Pressable>
          <Pressable
            style={[styles.filterTabButton, styles.filterTabButtonMargin, filterStatus === 'notGathered' && styles.filterTabButtonActive]}
            onPress={() => setFilterStatus('notGathered')}
          >
            <Text style={[styles.filterTabText, filterStatus === 'notGathered' && styles.filterTabTextActive]}>Not Gathered ({notGatheredCount})</Text>
          </Pressable>
        </View>
      </Animated.View>

      <FlatList
        data={displayedItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => {
          const price = parseFloat(item.price || 0);
          const quantity = item.quantity || 0;
          const total = price * quantity;

          return (
            <View
              style={[
                styles.itemCard,
                item.gathered ? styles.itemCardGathered : styles.itemCardNotGathered,
                index === displayedItems.length - 1 && styles.lastItemCard,
              ]}
            >
              <Text style={styles.itemIndex}>{index + 1}.</Text>

              <View style={styles.itemPhotoContainer}>
                {item.photo ? (
                  <Image
                    source={{ uri: `${BASE_STORAGE_URL}/custom-order-images/${item.photo}` }}
                    style={styles.itemPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.noItemImagePlaceholder}>
                    <Text style={styles.noItemImageText}>No Image</Text>
                  </View>
                )}
              </View>

              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.brand && <Text style={styles.itemBrand}>Brand: {item.brand}</Text>}
                {item.description && (
                  <Text style={styles.itemDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
                <Text style={styles.itemQuantity}>
                  Qty: <Text style={styles.itemQuantityHighlight}>{item.quantity}</Text>{item.unit ? ` ${item.unit}` : ''}
                </Text>
              </View>

              <View style={styles.itemPriceTotalContainer}>
                <Text style={styles.itemPrice}>₱{price.toFixed(2)}</Text>
                <Text style={styles.itemTotal}>Total: ₱{total.toFixed(2)}</Text>
              </View>

              <View
                style={[
                  styles.checkboxContainer,
                  { backgroundColor: item.gathered ? Colors.greenLight : Colors.lightGrey },
                ]}
              >
                <Checkbox
                  value={item.gathered}
                  onValueChange={() => toggleGathered(item.id, item.gathered)}
                  color={item.gathered ? Colors.primaryGreen : Colors.mediumGrey}
                  style={styles.checkbox}
                />
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.listFooter}>
            <Pressable
              onPress={() => setShowConfirmModal(true)}
              style={styles.saveButton}
              disabled={isUpdatingStatus} // Disable button while status is updating
            >
              {isUpdatingStatus ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>Save Gathering Info</Text>
              )}
            </Pressable>
          </View>
        }
        contentContainerStyle={styles.flatListContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      />

      {showConfirmModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Save</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to save this gathering update? This action cannot be undone.
            </Text>
            <View style={styles.modalButtonsContainer}>
              <Pressable
                onPress={() => setShowConfirmModal(false)}
                style={styles.modalCancelButton}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveGathering} // Call the new handler
                style={styles.modalConfirmButton}
                disabled={isUpdatingStatus} // Disable confirm button during update
              >
                {isUpdatingStatus ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>Confirm</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
    paddingTop: Platform.OS === 'android' ? 35 : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.indigo + '08',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: Colors.indigo,
    fontWeight: '600',
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.lightGrey + '80',
    padding: 24,
  },
  notFoundTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.red,
    marginBottom: 16,
    textAlign: 'center',
  },
  notFoundMessage: {
    fontSize: 16,
    color: Colors.mediumGrey,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  backButton: {
    backgroundColor: Colors.primaryBlue,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: Colors.primaryBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  backButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerContainer: {
    padding: 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.darkText,
  },
  backButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightGrey,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonHeaderText: {
    color: Colors.mediumGrey,
    fontSize: 16,
    fontWeight: '600',
  },
  gatheredCountContainer: {
    marginBottom: 24,
  },
  gatheredCountText: {
    fontSize: 18,
    color: Colors.mediumGrey,
    fontWeight: '500',
  },
  gatheredCountHighlight: {
    color: Colors.primaryGreen,
    fontWeight: '800',
  },
  totalItemsCount: {
    fontWeight: '800',
    color: Colors.darkText,
  },
  schoolInfoCard: {
    backgroundColor: Colors.blueLight,
    padding: 24,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.primaryBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.blueBorder,
    marginBottom: 16,
    position: 'relative',
  },
  schoolImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#93c5fd',
    objectFit: 'cover',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  noLogoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#93c5fd',
  },
  noLogoText: {
    color: Colors.primaryBlue,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  schoolDetails: {
    marginLeft: 20,
    flex: 1,
  },
  schoolDetailText: {
    fontSize: 16,
    color: Colors.mediumGrey,
    marginBottom: 4,
  },
  schoolDetailLabel: {
    fontWeight: 'bold',
    color: Colors.darkText,
  },
  schoolDetailValue: {
    fontWeight: '600',
    color: Colors.darkText,
  },
  searchInput: {
    width: '100%',
    backgroundColor: Colors.lightBackground,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    color: Colors.darkText,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.lightGrey,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  filterTabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  filterTabButtonMargin: {
    marginLeft: 4,
  },
  filterTabButtonActive: {
    backgroundColor: Colors.primaryBlue,
    shadowColor: Colors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  filterTabText: {
    fontWeight: '600',
    color: Colors.mediumGrey,
  },
  filterTabTextActive: {
    color: Colors.white,
  },
  flatListContent: {
    paddingBottom: 30,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  itemCardGathered: {
    backgroundColor: Colors.greenLight,
    borderColor: Colors.greenBorder,
  },
  itemCardNotGathered: {
    backgroundColor: Colors.white,
  },
  lastItemCard: {},
  itemIndex: {
    fontSize: 16,
    color: Colors.mediumGrey,
    width: '7%',
    fontWeight: '500',
  },
  itemPhotoContainer: {
    alignItems: 'center',
    width: 80,
    marginLeft: 8,
    marginRight: 16,
  },
  itemPhoto: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    objectFit: 'cover',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  noItemImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: Colors.lightGrey,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.mediumGrey,
  },
  noItemImageText: {
    color: Colors.mediumGrey,
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  itemDetails: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.darkText,
  },
  itemBrand: {
    fontSize: 14,
    color: Colors.mediumGrey,
    marginTop: 2,
  },
  itemDescription: {
    fontSize: 12,
    color: Colors.mediumGrey,
    marginTop: 2,
  },
  itemQuantity: {
    fontSize: 16,
    color: Colors.mediumGrey,
    marginTop: 8,
    fontWeight: '500',
  },
  itemQuantityHighlight: {
    fontWeight: '800',
    color: Colors.darkText,
  },
  itemPriceTotalContainer: {
    alignItems: 'flex-end',
    width: '20%',
    marginLeft: 8,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.darkText,
  },
  itemTotal: {
    fontSize: 14,
    color: Colors.mediumGrey,
  },
  checkboxContainer: {
    marginLeft: 16,
    padding: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    borderRadius: 8,
    width: 24,
    height: 24,
  },
  listFooter: {
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'flex-end',
  },
  saveButton: {
    backgroundColor: Colors.primaryGreen,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: Colors.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 20,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.white,
    padding: 32,
    borderRadius: 16,
    width: '100%',
    maxWidth: 384,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: Colors.darkText,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: Colors.mediumGrey,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  modalCancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    backgroundColor: Colors.lightBackground,
  },
  modalButtonText: {
    color: Colors.mediumGrey,
    fontWeight: '600',
    fontSize: 16,
  },
  modalConfirmButton: {
    backgroundColor: Colors.primaryGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: Colors.primaryGreen,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  modalConfirmButtonText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});