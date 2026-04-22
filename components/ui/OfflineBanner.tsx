import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/Colors';

export function OfflineBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>📡 You're offline — your data will sync when you reconnect</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.warning,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.text,
  },
});
