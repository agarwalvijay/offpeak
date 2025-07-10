import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotification from 'react-native-push-notification';

const COMED_API_BASE = 'https://hourlypricing.comed.com/api';

const App = () => {
  const [currentPrice, setCurrentPrice] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [alertSettings, setAlertSettings] = useState({
    lowThreshold: 5.0,
    mediumThreshold: 10.0,
    highThreshold: 15.0,
    alertsEnabled: true,
  });

  useEffect(() => {
    loadSettings();
    fetchCurrentPrice();
    fetchChartData();
    
    // Setup push notifications
    PushNotification.configure({
      onNotification: function(notification) {
        console.log('Notification:', notification);
      },
      requestPermissions: Platform.OS === 'ios',
    });

    // Set up periodic refresh
    const interval = setInterval(() => {
      fetchCurrentPrice();
      fetchChartData();
    }, 300000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('alertSettings');
      if (saved) {
        setAlertSettings(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem('alertSettings', JSON.stringify(newSettings));
      setAlertSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const fetchCurrentPrice = async () => {
    try {
      const response = await fetch(`${COMED_API_BASE}?type=currenthouraverage`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const price = parseFloat(data[0].price);
        const timestamp = new Date(parseInt(data[0].millisUTC));
        
        setCurrentPrice({ price, timestamp });
        setLastUpdate(new Date());
        
        // Check for alerts
        checkPriceAlert(price);
      }
    } catch (error) {
      console.error('Error fetching current price:', error);
      Alert.alert('Error', 'Failed to fetch current pricing data');
    }
  };

  const fetchChartData = async () => {
    try {
      const response = await fetch(`${COMED_API_BASE}?type=5minutefeed`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        // Take last 24 data points for chart
        const recentData = data.slice(-24);
        const labels = recentData.map((item, index) => {
          const date = new Date(parseInt(item.millisUTC));
          return date.getHours().toString().padStart(2, '0');
        });
        const prices = recentData.map(item => parseFloat(item.price));
        
        setChartData({
          labels,
          datasets: [{
            data: prices,
            color: (opacity = 1) => `rgba(31, 119, 180, ${opacity})`,
            strokeWidth: 2,
          }],
        });
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    }
  };

  const checkPriceAlert = (price) => {
    if (!alertSettings.alertsEnabled) return;

    let alertMessage = null;
    
    if (price >= alertSettings.highThreshold) {
      alertMessage = `High Price Alert: ${price.toFixed(2)}¢/kWh`;
    } else if (price <= alertSettings.lowThreshold) {
      alertMessage = `Low Price Alert: ${price.toFixed(2)}¢/kWh - Good time to use electricity!`;
    } else if (price < 0) {
      alertMessage = `Negative Pricing: ${price.toFixed(2)}¢/kWh - You're being paid to use electricity!`;
    }

    if (alertMessage) {
      PushNotification.localNotification({
        title: 'ComEd Pricing Alert',
        message: alertMessage,
        playSound: true,
        soundName: 'default',
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchCurrentPrice(), fetchChartData()]);
    setRefreshing(false);
  };

  const getPriceStatus = () => {
    if (!currentPrice) return { text: 'Loading...', color: '#666' };
    
    const { price } = currentPrice;
    
    if (price < 0) {
      return { text: 'NEGATIVE PRICING', color: '#8e44ad' };
    } else if (price <= alertSettings.lowThreshold) {
      return { text: 'LOW PRICE', color: '#27ae60' };
    } else if (price <= alertSettings.mediumThreshold) {
      return { text: 'MODERATE PRICE', color: '#f39c12' };
    } else if (price <= alertSettings.highThreshold) {
      return { text: 'HIGH PRICE', color: '#e67e22' };
    } else {
      return { text: 'VERY HIGH PRICE', color: '#e74c3c' };
    }
  };

  const status = getPriceStatus();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>⚡ ComEd Pricing</Text>
          <Text style={styles.subtitle}>Real-time electricity pricing</Text>
        </View>

        {/* Current Price Card */}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Current Hour Average</Text>
          <Text style={styles.priceValue}>
            {currentPrice ? `${currentPrice.price.toFixed(2)}¢` : 'Loading...'}
          </Text>
          <Text style={[styles.priceStatus, { color: status.color }]}>
            {status.text}
          </Text>
          {currentPrice && (
            <Text style={styles.timestamp}>
              As of {currentPrice.timestamp.toLocaleTimeString()}
            </Text>
          )}
        </View>

        {/* Chart */}
        {chartData && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>24-Hour Pricing Trend</Text>
            <LineChart
              data={chartData}
              width={350}
              height={220}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(31, 119, 180, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: '#1f77b4',
                },
              }}
              bezier
              style={styles.chart}
            />
          </View>
        )}

        {/* Quick Stats */}
        {chartData && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {Math.min(...chartData.datasets[0].data).toFixed(1)}¢
              </Text>
              <Text style={styles.statLabel}>24h Min</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {Math.max(...chartData.datasets[0].data).toFixed(1)}¢
              </Text>
              <Text style={styles.statLabel}>24h Max</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {(chartData.datasets[0].data.reduce((a, b) => a + b, 0) / 
                  chartData.datasets[0].data.length).toFixed(1)}¢
              </Text>
              <Text style={styles.statLabel}>24h Avg</Text>
            </View>
          </View>
        )}

        {/* Usage Recommendations */}
        <View style={styles.recommendationsCard}>
          <Text style={styles.recommendationsTitle}>Usage Recommendations</Text>
          {currentPrice && (
            <View style={styles.recommendations}>
              {getUsageRecommendations(currentPrice.price).map((rec, index) => (
                <Text key={index} style={styles.recommendationItem}>
                  • {rec}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Last Update */}
        {lastUpdate && (
          <Text style={styles.lastUpdate}>
            Last updated: {lastUpdate.toLocaleTimeString()}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const getUsageRecommendations = (price) => {
  if (price < 0) {
    return [
      'Run all major appliances now',
      'Charge electric vehicles',
      'Use electric heating/cooling as needed',
    ];
  } else if (price <= 5.0) {
    return [
      'Great time to run dishwasher',
      'Do laundry loads',
      'Charge electric vehicles',
    ];
  } else if (price <= 10.0) {
    return [
      'Normal usage is fine',
      'Consider timing major appliances',
    ];
  } else if (price <= 15.0) {
    return [
      'Delay running dishwasher if possible',
      'Avoid using dryer',
      'Reduce air conditioning/heating slightly',
    ];
  } else {
    return [
      'Avoid unnecessary electricity usage',
      'Turn off non-essential appliances',
      'Delay all major appliance usage',
    ];
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#1f77b4',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
    marginTop: 4,
  },
  priceCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  priceLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1f77b4',
    marginBottom: 8,
  },
  priceStatus: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  chartContainer: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f77b4',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  recommendationsCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  recommendations: {
    marginTop: 8,
  },
  recommendationItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
  lastUpdate: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginBottom: 20,
  },
});

export default App;