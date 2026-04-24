/**
 * Bare-minimum React Native API Testing App
 * For testing backend endpoints and notification events
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { api } from './src/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<'auth' | 'venues' | 'bookings' | 'custom'>('auth');
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Auth form
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('Test User');
  const [nickname, setNickname] = useState('Tester');

  // Venue form
  const [searchTerm, setSearchTerm] = useState('');

  // Booking form
  const [venueId, setVenueId] = useState('');
  const [date, setDate] = useState('2026-04-25');
  const [startTime, setStartTime] = useState('10:00');
  const [bookingId, setBookingId] = useState('');

  // Custom endpoint form
  const [customMethod, setCustomMethod] = useState('GET');
  const [customEndpoint, setCustomEndpoint] = useState('/venues');
  const [customData, setCustomData] = useState('');

  const handleRequest = async (requestFn: () => Promise<any>, label: string) => {
    setLoading(true);
    setResponse('Loading...');
    try {
      const result = await requestFn();
      setResponse(`✅ ${label}\n\n${JSON.stringify(result.data, null, 2)}`);
    } catch (error: any) {
      const errorMsg = error.response?.data || error.message || 'Unknown error';
      setResponse(`❌ ${label}\n\n${JSON.stringify(errorMsg, null, 2)}`);
    } finally {
      setLoading(false);
    }
  };

  const renderAuthTab = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Authentication</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Nickname"
        value={nickname}
        onChangeText={setNickname}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => handleRequest(
          () => api.signup({ name, nickname, email, password }),
          'Signup'
        )}
      >
        <Text style={styles.buttonText}>POST /auth/signup</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => handleRequest(
          () => api.login({ email, password }),
          'Login'
        )}
      >
        <Text style={styles.buttonText}>POST /auth/login</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={() => {
          api.logout();
          Alert.alert('Logged out', 'Token cleared');
        }}
      >
        <Text style={styles.buttonText}>Logout (clear token)</Text>
      </TouchableOpacity>
    </View>
  );

  const renderVenuesTab = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Venues</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Search term (optional)"
        value={searchTerm}
        onChangeText={setSearchTerm}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => handleRequest(
          () => api.getVenues(searchTerm || undefined),
          'Get Venues'
        )}
      >
        <Text style={styles.buttonText}>GET /venues</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Venue ID"
        value={venueId}
        onChangeText={setVenueId}
      />
      <TextInput
        style={styles.input}
        placeholder="Date (YYYY-MM-DD)"
        value={date}
        onChangeText={setDate}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => handleRequest(
          () => api.getAvailability(venueId, date),
          'Get Availability'
        )}
      >
        <Text style={styles.buttonText}>GET /availability</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBookingsTab = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Bookings</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Venue ID"
        value={venueId}
        onChangeText={setVenueId}
      />
      <TextInput
        style={styles.input}
        placeholder="Date (YYYY-MM-DD)"
        value={date}
        onChangeText={setDate}
      />
      <TextInput
        style={styles.input}
        placeholder="Start Time (HH:MM)"
        value={startTime}
        onChangeText={setStartTime}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => handleRequest(
          () => api.createBooking({ venueId, date, startTime }),
          'Create Booking'
        )}
      >
        <Text style={styles.buttonText}>POST /bookings</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Booking ID"
        value={bookingId}
        onChangeText={setBookingId}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => handleRequest(
          () => api.getBookingDetails(bookingId),
          'Get Booking Details'
        )}
      >
        <Text style={styles.buttonText}>GET /bookings/:id/details</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonDanger]}
        onPress={() => handleRequest(
          () => api.cancelBooking(bookingId),
          'Cancel Booking'
        )}
      >
        <Text style={styles.buttonText}>POST /bookings/:id/cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCustomTab = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Custom Endpoint</Text>
      
      <View style={styles.row}>
        {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => (
          <TouchableOpacity
            key={method}
            style={[
              styles.methodButton,
              customMethod === method && styles.methodButtonActive,
            ]}
            onPress={() => setCustomMethod(method)}
          >
            <Text style={styles.methodButtonText}>{method}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Endpoint (e.g., /venues)"
        value={customEndpoint}
        onChangeText={setCustomEndpoint}
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder='Request body/params (JSON)\ne.g., {"q": "mall"}'
        value={customData}
        onChangeText={setCustomData}
        multiline
        numberOfLines={4}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          let parsedData;
          try {
            parsedData = customData ? JSON.parse(customData) : undefined;
          } catch (e) {
            Alert.alert('Invalid JSON', 'Please check your request body/params');
            return;
          }
          handleRequest(
            () => api.testEndpoint(customMethod, customEndpoint, parsedData),
            'Custom Request'
          );
        }}
      >
        <Text style={styles.buttonText}>Send Request</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>API Tester</Text>
        <Text style={styles.subtitle}>Backend endpoint testing tool</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'auth' && styles.tabActive]}
          onPress={() => setActiveTab('auth')}
        >
          <Text style={styles.tabText}>Auth</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'venues' && styles.tabActive]}
          onPress={() => setActiveTab('venues')}
        >
          <Text style={styles.tabText}>Venues</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bookings' && styles.tabActive]}
          onPress={() => setActiveTab('bookings')}
        >
          <Text style={styles.tabText}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'custom' && styles.tabActive]}
          onPress={() => setActiveTab('custom')}
        >
          <Text style={styles.tabText}>Custom</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'auth' && renderAuthTab()}
        {activeTab === 'venues' && renderVenuesTab()}
        {activeTab === 'bookings' && renderBookingsTab()}
        {activeTab === 'custom' && renderCustomTab()}

        <View style={styles.responseContainer}>
          <Text style={styles.responseTitle}>Response:</Text>
          <ScrollView style={styles.responseBox}>
            <Text style={styles.responseText}>{response || 'No response yet'}</Text>
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 16,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonSecondary: {
    backgroundColor: '#757575',
  },
  buttonDanger: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  methodButton: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  methodButtonActive: {
    backgroundColor: '#2196F3',
  },
  methodButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  responseContainer: {
    padding: 16,
  },
  responseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  responseBox: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    maxHeight: 300,
  },
  responseText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#00ff00',
  },
});
