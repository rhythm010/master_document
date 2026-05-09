import { View, Text, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import { Link } from 'expo-router';
import { useState } from 'react';

export default function Index() {
  const [healthStatus, setHealthStatus] = useState<string>('Not checked');

  const checkHealth = async () => {
    try {
      setHealthStatus('Checking...');
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        setHealthStatus(`Healthy: ${JSON.stringify(data)}`);
      } else {
        setHealthStatus(`Error: ${response.status}`);
      }
    } catch (error: any) {
      setHealthStatus(`Failed: ${error.message}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Companion App - Milestone 0</Text>
      <Text style={styles.subtitle}>Environment: {process.env.EXPO_PUBLIC_ENV || 'unknown'}</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backend Health Check</Text>
        <Text>Status: {healthStatus}</Text>
        <Button title="Check Health" onPress={checkHealth} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>V1 Route Placeholders</Text>
        <Link href="/onboarding" style={styles.link}>Go to Onboarding</Link>
        <Link href="/location" style={styles.link}>Go to Location</Link>
        <Link href="/booking/calendar" style={styles.link}>Go to Calendar</Link>
        <Link href="/booking/time" style={styles.link}>Go to Time</Link>
        <Link href="/booking/companion-type" style={styles.link}>Go to Companion Type</Link>
        <Link href="/booking/book-now" style={styles.link}>Go to Book Now</Link>
        <Link href="/booking/confirmation" style={styles.link}>Go to Confirmation</Link>
        <Link href="/matching" style={styles.link}>Go to Matching</Link>
        <Link href="/in-service" style={styles.link}>Go to In Service</Link>
        <Link href="/feedback" style={styles.link}>Go to Feedback</Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    width: '100%',
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  link: {
    color: '#007AFF',
    fontSize: 16,
    marginVertical: 8,
  }
});
