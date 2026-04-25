import React, { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  secureToggle?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, secureToggle, leftIcon, style, ...props },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, focused && styles.focused, error && styles.errorBorder]}>
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={18}
            color={Colors.textLight}
            style={styles.leftIcon}
          />
        )}
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={secureToggle ? !showPassword : props.secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {secureToggle && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={Colors.textLight}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.text,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  focused: { borderColor: Colors.primary },
  errorBorder: { borderColor: Colors.error },
  leftIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: Colors.text,
  },
  error: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },
});
