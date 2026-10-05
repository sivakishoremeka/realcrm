import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import api from '../api/client';
import Button from './Button';
import Card from './Card';
import ChipRow from './ChipRow';
import Field from './Field';
import RatedAvatar from './RatedAvatar';
import { colors, spacing, type } from '../constants/theme';

const RATING_OPTIONS = [1, 2, 3, 4, 5];
const RATING_LABELS = { 1: '1★', 2: '2★', 3: '3★', 4: '4★', 5: '5★' };

/**
 * Rate a publisher/agent.
 * Pass either `requirementId` (admin/leadgen) or `enquiryId` (customer).
 */
export default function RateAgentCard({
  agentId,
  agentName,
  profilePic,
  ratingAvg = 0,
  ratingCount = 0,
  requirementId,
  enquiryId,
  title = 'Rate this publisher',
  hint = 'Your rating helps others choose trusted publishers.',
  onSubmitted,
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  if (!agentId) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const body = {
        rating,
        comment: comment.trim(),
      };
      if (requirementId) body.requirement = requirementId;
      if (enquiryId) body.enquiry = enquiryId;

      const { data } = await api.post(`/api/agents/${agentId}/reviews`, body);
      Alert.alert('Thank you', 'Your rating was saved.');
      setComment('');
      onSubmitted?.(data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save rating');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={styles.header}>
        <RatedAvatar
          uri={profilePic}
          name={agentName}
          ratingAvg={ratingAvg}
          ratingCount={ratingCount}
          size={56}
        />
        <View style={styles.headerText}>
          <Text style={type.heading}>{title}</Text>
          {!!agentName && <Text style={type.secondary}>{agentName}</Text>}
        </View>
      </View>
      <Text style={[type.secondary, styles.hint]}>{hint}</Text>
      <Text style={styles.label}>Stars</Text>
      <ChipRow
        options={RATING_OPTIONS}
        value={rating}
        onSelect={setRating}
        labels={RATING_LABELS}
      />
      <Field
        label="Comment (optional)"
        containerStyle={styles.field}
        value={comment}
        onChangeText={setComment}
        multiline
        placeholder="What went well?"
      />
      <Button title="Submit rating" onPress={submit} disabled={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1 },
  hint: { marginTop: spacing.sm },
  label: {
    ...type.caption,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  field: { marginTop: spacing.md },
});
