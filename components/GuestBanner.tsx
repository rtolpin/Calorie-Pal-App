import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/Colors';

export function GuestBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        👋 You're using CaloriePal as a Guest —{' '}
        <Text
          style={styles.link}
          onPress={() => router.push('/(auth)/create-account')}
        >
          Create a free account
        </Text>{' '}
        to save your data!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.accent2,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.text,
    textAlign: 'center',
  },
  link: {
    fontFamily: 'Nunito_700Bold',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});
