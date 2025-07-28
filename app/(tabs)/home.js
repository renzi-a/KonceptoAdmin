import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { BASE_URL } from '../../config'; // FIX: Changed import from BASE_URL to BASE_URL

const DashboardCard = ({ label, value, iconName, iconColor, valueStyle }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      {iconName && <Icon name={iconName} size={24} color={iconColor || '#6b7280'} style={styles.cardIcon} />}
      <Text style={styles.label}>{label}</Text>
    </View>
    <Text style={[styles.value, valueStyle]}>{value}</Text>
  </View>
);

const ProgressBar = ({ label, percentage, color }) => (
  <View style={styles.progressBarContainer}>
    <Text style={styles.progressBarLabel}>{label}</Text>
    <View style={styles.progressBarBackground}>
      <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
    </View>
    <Text style={styles.progressBarPercentage}>{`${Math.round(percentage)}%`}</Text>
  </View>
);

export default function HomeScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use BASE_API_URL which is now correctly imported
      const res = await axios.get(`${BASE_URL}/dashboard.php`);
      setData(res.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-triangle" size={50} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryButtonText}>Tap to Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalOrders = (data?.pendingOrders || 0) + (data?.completedOrders || 0);
  const totalCustomOrders = (data?.customPending || 0) + (data?.customCompleted || 0);

  const pendingOrderPercentage = totalOrders > 0 ? ((data.pendingOrders || 0) / totalOrders) * 100 : 0;
  const completedOrderPercentage = totalOrders > 0 ? ((data.completedOrders || 0) / totalOrders) * 100 : 0;
  const customPendingPercentage = totalCustomOrders > 0 ? ((data.customPending || 0) / totalCustomOrders) * 100 : 0;
  const customCompletedPercentage = totalCustomOrders > 0 ? ((data.customCompleted || 0) / totalCustomOrders) * 100 : 0;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#22c55e']} />
      }
    >
      <Text style={styles.header}>Welcome back, Admin!</Text>

      <View style={styles.cardsGrid}>
        <DashboardCard
          label="Pending Orders"
          value={data?.pendingOrders}
          iconName="hourglass-half"
          iconColor="#f59e0b"
        />
        <DashboardCard
          label="Completed Orders"
          value={data?.completedOrders}
          iconName="check-circle"
          iconColor="#22c55e"
        />
        <DashboardCard
          label="Pending Custom"
          value={data?.customPending}
          iconName="clipboard-list"
          iconColor="#3b82f6"
        />
        <DashboardCard
          label="Completed Custom"
          value={data?.customCompleted}
          iconName="boxes"
          iconColor="#10b981"
        />
      </View>

      <DashboardCard
        label="Total Revenue"
        value={`₱${parseFloat(data?.totalRevenue || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
        iconName="money-bill-wave"
        iconColor="#16a34a"
        valueStyle={styles.revenueValue}
      />

      <View style={styles.sectionHeaderContainer}>
        <Icon name="chart-pie" size={20} color="#4b5563" style={{ marginRight: 8 }} />
        <Text style={styles.sectionHeader}>Order Overview</Text>
      </View>
      {totalOrders > 0 ? (
        <>
          <ProgressBar label="Overall Pending" percentage={pendingOrderPercentage} color="#f59e0b" />
          <ProgressBar label="Overall Completed" percentage={completedOrderPercentage} color="#22c55e" />
        </>
      ) : (
        <Text style={styles.noDataText}>No regular orders to display progress.</Text>
      )}

      <View style={styles.sectionHeaderContainer}>
        <Icon name="chart-bar" size={20} color="#4b5563" style={{ marginRight: 8 }} />
        <Text style={styles.sectionHeader}>Custom Order Overview</Text>
      </View>
      {totalCustomOrders > 0 ? (
        <>
          <ProgressBar label="Custom Pending" percentage={customPendingPercentage} color="#3b82f6" />
          <ProgressBar label="Custom Completed" percentage={customCompletedPercentage} color="#10b981" />
        </>
      ) : (
        <Text style={styles.noDataText}>No custom orders to display progress.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 35,
    padding: 20,
    backgroundColor: '#f3f4f6',
    minHeight: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#4b5563',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    marginTop: 15,
    fontSize: 18,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#1a202c',
    textAlign: 'center',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#fff',
    padding: 18,
    marginBottom: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
    flexBasis: '48%',
    minWidth: 150,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardIcon: {
    marginRight: 10,
  },
  label: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
    flexShrink: 1,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 5,
  },
  revenueValue: {
    color: '#16a34a',
    fontSize: 26,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 8,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
  },
  progressBarContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  progressBarLabel: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
    fontWeight: '500',
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressBarPercentage: {
    alignSelf: 'flex-end',
    marginTop: 5,
    fontSize: 12,
    color: '#4b5563',
  },
  noDataText: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 10,
    marginBottom: 20,
    fontSize: 14,
  }
});
