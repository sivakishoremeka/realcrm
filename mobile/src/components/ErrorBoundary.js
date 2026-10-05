import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Button from './Button';
import { colors, spacing, type } from '../constants/theme';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('App crash:', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Something went wrong
        </Text>
        <Text style={styles.message}>{String(error?.message || error)}</Text>
        {!!error?.stack && (
          <Text style={styles.stack} numberOfLines={12}>
            {String(error.stack)}
          </Text>
        )}
        <Button title="Try again" onPress={() => this.setState({ error: null })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: {
    ...type.heading,
    marginBottom: spacing.sm,
  },
  message: {
    ...type.secondary,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  stack: {
    ...type.caption,
    fontWeight: '400',
    marginBottom: spacing.lg,
  },
});
