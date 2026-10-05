import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
import ChipRow from '../components/ChipRow';
import { formatPrice } from '../components/PriceField';
import Field from '../components/Field';
import RateAgentCard from '../components/RateAgentCard';
import RatedAvatar from '../components/RatedAvatar';
import StatusBadge from '../components/StatusBadge';
import LoadingOverlay from '../components/LoadingOverlay';
import { useAuth } from '../context/AuthContext';
import { CARE_INTERACTION_TYPES } from '../constants/config';
import { starsLabel } from '../constants/rating';
import { colors, radius, spacing, type } from '../constants/theme';
import { shareLeadRequestOnWhatsApp } from '../utils/whatsappShare';

function InfoRow({ label, value, strong }) {
  return (
    <View style={styles.infoRow}>
      <Text style={type.secondary}>{label}</Text>
      <Text style={[type.body, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

export default function RequirementDetailScreen({ route }) {
  const { requirementId } = route.params;
  const { user } = useAuth();
  const [requirement, setRequirement] = useState(null);
  const [matches, setMatches] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [commissionPercent, setCommissionPercent] = useState('0');
  const [leadGenSharePercent, setLeadGenSharePercent] = useState('50');
  const [commissionNotes, setCommissionNotes] = useState('');
  const [buyerHappyNotes, setBuyerHappyNotes] = useState('');

  const [careType, setCareType] = useState('FollowUp');
  const [careNotes, setCareNotes] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');

  const isAdmin = user?.role === 'admin';
  const uid = String(user?.id || user?._id || '');
  const canEditCommission =
    isAdmin ||
    String(requirement?.createdBy?._id || requirement?.createdBy) === uid ||
    String(requirement?.leadGenerator?._id || requirement?.leadGenerator) === uid;
  const servingAgentId =
    requirement?.assignedAgent?._id || requirement?.assignedAgent || null;

  const hydrateCommission = (data) => {
    setCommissionPercent(String(data.commissionPercent ?? 0));
    setLeadGenSharePercent(String(data.leadGenSharePercent ?? 50));
    setCommissionNotes(data.commissionNotes || '');
    setBuyerHappyNotes(data.buyerHappyNotes || '');
    if (data.nextFollowUpAt) {
      setNextFollowUpAt(String(data.nextFollowUpAt).slice(0, 10));
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const reqRes = await api.get(`/api/requirements/${requirementId}`);
      setRequirement(reqRes.data);
      hydrateCommission(reqRes.data);

      if (reqRes.data.customer?._id) {
        const intRes = await api
          .get(`/api/interactions/${reqRes.data.customer._id}`, {
            params: { requirement: requirementId },
          })
          .catch(() => ({ data: [] }));
        setInteractions(intRes.data || []);
      }

      try {
        const matchRes = await api.get(`/api/requirements/${requirementId}/matches`);
        setMatches(matchRes.data.matches || []);
        if (matchRes.data.requirement) {
          setRequirement(matchRes.data.requirement);
          hydrateCommission(matchRes.data.requirement);
        }
      } catch (matchErr) {
        if (matchErr.response?.status !== 403) {
          throw matchErr;
        }
        setMatches([]);
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [requirementId])
  );

  const assign = (agentId, agentName) => {
    Alert.alert('Assign to serve', `Connect this buyer to ${agentName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Assign',
        onPress: async () => {
          setBusy(true);
          try {
            const { data } = await api.post(`/api/requirements/${requirementId}/assign`, {
              agentId,
            });
            setRequirement(data);
            Alert.alert('Assigned', `${agentName} will serve this buyer.`);
          } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Assign failed');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const saveCommission = async () => {
    setBusy(true);
    try {
      const { data } = await api.put(`/api/requirements/${requirementId}`, {
        commissionPercent: Number(commissionPercent) || 0,
        leadGenSharePercent: Number(leadGenSharePercent) || 0,
        commissionNotes,
        buyerHappyNotes,
        nextFollowUpAt: nextFollowUpAt || null,
      });
      setRequirement(data);
      hydrateCommission(data);
      Alert.alert('Saved', 'Commission split and care notes updated.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const addCareFollowUp = async () => {
    if (!requirement?.customer?._id) return;
    if (!careNotes.trim()) {
      Alert.alert('Notes', 'Add a short note about how you helped the buyer.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        customer: requirement.customer._id,
        requirement: requirementId,
        type: careType,
        notes: careNotes.trim(),
        nextFollowUpAt: nextFollowUpAt || null,
      };
      const { data } = await api.post('/api/interactions', payload);
      setInteractions((prev) => [data, ...prev]);
      setCareNotes('');
      if (nextFollowUpAt || buyerHappyNotes) {
        const { data: reqData } = await api.put(`/api/requirements/${requirementId}`, {
          nextFollowUpAt: nextFollowUpAt || null,
          buyerHappyNotes,
        });
        setRequirement(reqData);
      }
      Alert.alert('Logged', 'Buyer-care follow-up saved.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not log follow-up');
    } finally {
      setBusy(false);
    }
  };

  const markClosed = async () => {
    setBusy(true);
    try {
      const { data } = await api.put(`/api/requirements/${requirementId}`, {
        status: 'Closed',
      });
      setRequirement(data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const servingShare = Math.max(
    0,
    100 - (Number(leadGenSharePercent) || 0)
  );

  if (!requirement && loading) {
    return (
      <View style={styles.container}>
        <LoadingOverlay visible />
      </View>
    );
  }

  const budgetLabel = `${formatPrice(requirement?.budgetMin || 0)}${
    requirement?.budgetMax != null ? ` – ${formatPrice(requirement.budgetMax)}` : '+'
  }`;

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading || busy} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={styles.titleRow}>
            <Text style={[type.heading, styles.flex]}>{requirement?.customer?.name}</Text>
            <StatusBadge status={requirement?.status} />
          </View>
          <InfoRow label="Phone" value={requirement?.customer?.phone || 'No phone'} />
          <InfoRow label="Email" value={requirement?.customer?.email || 'No email'} />
          <InfoRow
            label="Looking for"
            value={`${requirement?.propertyType} · ${requirement?.listingType}`}
          />
          <InfoRow
            label="BHK"
            value={`${requirement?.bhkMin ?? '—'}–${requirement?.bhkMax ?? '—'}`}
          />
          <InfoRow label="Budget" value={budgetLabel} strong />
          <InfoRow
            label="Zones"
            value={(requirement?.preferredZones || []).map((z) => z.name).join(', ') || 'Any'}
          />
          {requirement?.leadGenerator && (
            <InfoRow label="Lead generator" value={requirement.leadGenerator.name} />
          )}
          {requirement?.assignedAgent && (
            <InfoRow
              label="Serving agent"
              value={`${requirement.assignedAgent.name} (${requirement.assignedAgent.email})`}
            />
          )}
          {!!requirement?.notes && <InfoRow label="Notes" value={requirement.notes} />}
        </Card>

        {canEditCommission && (
          <Card>
            <Text style={type.heading}>Commission split</Text>
            <Text style={[type.secondary, styles.hint]}>
              Total brokerage on the deal, then how much goes to the lead generator vs serving
              agent.
            </Text>
            <View style={styles.fieldRow}>
              <Field
                label="Total %"
                containerStyle={styles.fieldHalf}
                keyboardType="decimal-pad"
                value={commissionPercent}
                onChangeText={setCommissionPercent}
              />
              <Field
                label="Lead-gen share %"
                containerStyle={styles.fieldHalf}
                keyboardType="decimal-pad"
                value={leadGenSharePercent}
                onChangeText={setLeadGenSharePercent}
              />
            </View>
            <Text style={[type.body, styles.strong, styles.computed]}>
              Serving agent share: {servingShare}% of commission
              {Number(commissionPercent) > 0
                ? ` (${((Number(commissionPercent) * servingShare) / 100).toFixed(2)} pts of deal)`
                : ''}
            </Text>
            <Field
              label="Commission notes"
              value={commissionNotes}
              onChangeText={setCommissionNotes}
              placeholder="e.g. Shared intro, site visits by serving agent"
            />
            <Field
              label="Buyer-happy notes"
              value={buyerHappyNotes}
              onChangeText={setBuyerHappyNotes}
              multiline
              placeholder="What would make this buyer feel cared for?"
            />
            <Button
              title="Save commission & care notes"
              variant="secondary"
              onPress={saveCommission}
              style={styles.action}
            />
          </Card>
        )}

        <Card>
          <Text style={type.heading}>Buyer care follow-ups</Text>
          <Text style={[type.secondary, styles.hint]}>
            Community service mindset — check in, listen, and keep the buyer happy.
          </Text>
          <Text style={styles.fieldLabel}>Type</Text>
          <ChipRow options={CARE_INTERACTION_TYPES} value={careType} onSelect={setCareType} />
          <Field
            label="Notes"
            value={careNotes}
            onChangeText={setCareNotes}
            multiline
            placeholder="What did you do for the buyer today?"
          />
          <Field
            label="Next follow-up (YYYY-MM-DD)"
            value={nextFollowUpAt}
            onChangeText={setNextFollowUpAt}
            placeholder="2026-10-10"
          />
          <Button title="Log follow-up" onPress={addCareFollowUp} style={styles.action} />
          {interactions.map((item, index) => (
            <View
              key={item._id}
              style={[styles.listRow, styles.divider, index === 0 && styles.action]}
            >
              <Text style={[type.body, styles.semibold]}>
                {item.type} · {item.createdBy?.name || 'You'}
              </Text>
              <Text style={[type.secondary, styles.rowLine]}>{item.notes}</Text>
              {item.nextFollowUpAt ? (
                <Text style={[type.caption, styles.rowLine]}>
                  Next: {String(item.nextFollowUpAt).slice(0, 10)}
                </Text>
              ) : null}
            </View>
          ))}
        </Card>

        <Card>
          <Text style={type.heading}>Matched agents</Text>
          {matches.length === 0 ? (
            <Text style={[type.secondary, styles.hint]}>
              No strong matches yet. Ask agents to complete onboarding and add inventory.
            </Text>
          ) : (
            matches.map((m, index) => (
              <View key={m.agent.id} style={[styles.listRow, index > 0 && styles.divider]}>
                <View style={styles.titleRow}>
                  <RatedAvatar
                    uri={m.agent.profilePic}
                    name={m.agent.name}
                    ratingAvg={m.agent.ratingAvg}
                    ratingCount={m.agent.ratingCount}
                    size={48}
                  />
                  <View style={styles.flex}>
                    <Text style={[type.body, styles.semibold]}>{m.agent.name}</Text>
                    <Text style={[type.secondary, styles.rowLine]}>
                      {starsLabel(m.agent.ratingAvg, m.agent.ratingCount)}
                    </Text>
                  </View>
                  <Text
                    style={[type.heading, styles.score]}
                    accessibilityLabel={`Match score ${m.score}`}
                  >
                    {m.score}
                  </Text>
                </View>
                <Text style={[type.secondary, styles.rowLine]}>
                  {m.agent.agencyName || 'Independent'}
                  {m.agent.yearsExperience
                    ? ` · ${m.agent.yearsExperience} yrs`
                    : ''}
                </Text>
                <Text style={[type.secondary, styles.rowLine]}>
                  {(m.agent.zones || []).map((z) => z.name).join(', ') || 'No zones'}
                </Text>
                <Text style={[type.secondary, styles.rowLine]}>
                  {m.matchingPropertyCount} matching · {m.inventoryCount} total listings
                </Text>
                <View style={styles.reasons}>
                  {(m.reasons || []).map((r) => (
                    <View key={r} style={styles.reasonChip}>
                      <Text style={[type.caption, styles.reasonText]}>{r}</Text>
                    </View>
                  ))}
                </View>
                <Button
                  title="Assign to serve"
                  variant="secondary"
                  onPress={() => assign(m.agent.id, m.agent.name)}
                  style={styles.stacked}
                />
                <Button
                  title="Share request on WhatsApp"
                  variant="secondary"
                  onPress={() => shareLeadRequestOnWhatsApp(requirement, m.agent)}
                  style={styles.stacked}
                />
              </View>
            ))
          )}
        </Card>

        {servingAgentId && canEditCommission && (
          <>
            <RateAgentCard
              agentId={servingAgentId}
              agentName={
                requirement?.assignedAgent?.name ||
                matches.find((m) => String(m.agent.id) === String(servingAgentId))?.agent
                  ?.name
              }
              profilePic={
                requirement?.assignedAgent?.profilePic ||
                matches.find((m) => String(m.agent.id) === String(servingAgentId))?.agent
                  ?.profilePic
              }
              ratingAvg={
                matches.find((m) => String(m.agent.id) === String(servingAgentId))?.agent
                  ?.ratingAvg || 0
              }
              ratingCount={
                matches.find((m) => String(m.agent.id) === String(servingAgentId))?.agent
                  ?.ratingCount || 0
              }
              requirementId={requirementId}
              title={isAdmin ? 'Business Owner rating' : 'Rate serving agent'}
              hint="Help the community recognize great buyer care."
              onSubmitted={() => load()}
            />
            {requirement?.status !== 'Closed' && (
              <Card>
                <Button title="Mark lead closed" variant="danger" onPress={markClosed} />
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  strong: { fontWeight: '700' },
  semibold: { fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoRow: { marginTop: spacing.sm },
  hint: { marginTop: spacing.xs, marginBottom: spacing.sm },
  fieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    columnGap: spacing.md,
  },
  fieldHalf: { flexGrow: 1, flexBasis: 120 },
  fieldLabel: {
    ...type.secondary,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  computed: { marginTop: spacing.sm },
  action: { marginTop: spacing.md },
  stacked: { marginTop: spacing.sm },
  listRow: { paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLine: { marginTop: spacing.xs },
  score: { color: colors.primary, minWidth: 36, textAlign: 'right' },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  reasonChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
  },
  reasonText: { color: colors.primary },
});
