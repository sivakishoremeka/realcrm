import React from 'react';
import { StyleSheet, View } from 'react-native';
import ChipRow from './ChipRow';
import Field from './Field';
import { spacing } from '../constants/theme';

// Rupees per unit. Prices are stored in rupees; the unit is only how they are typed.
const UNIT_RUPEES = { Lakhs: 100000, Cr: 10000000 };
export const PRICE_UNITS = Object.keys(UNIT_RUPEES);

/** "85" + "Lakhs" → 8500000. Returns NaN when the amount is not a number. */
export function toRupees(amount, unit) {
  if (String(amount).trim() === '') return NaN;
  return Math.round(Number(amount) * UNIT_RUPEES[unit]);
}

/** 8500000 → { amount: "85", unit: "Lakhs" }; one crore and above is shown in Cr. */
export function splitRupees(rupees) {
  if (rupees == null) return { amount: '', unit: 'Lakhs' };
  const unit = rupees >= UNIT_RUPEES.Cr ? 'Cr' : 'Lakhs';
  return { amount: String(rupees / UNIT_RUPEES[unit]), unit };
}

/** 300000 → "3L", 30000000 → "3Cr" (at most 2 decimals). */
export function formatPrice(rupees) {
  if (rupees == null) return '—';
  const { amount, unit } = splitRupees(Number(rupees));
  return `${Number(Number(amount).toFixed(2))}${unit === 'Cr' ? 'Cr' : 'L'}`;
}

/**
 * Price typed as an amount plus a Lakhs / Cr denomination.
 * @param {{ label: string, amount: string, unit: string, onChangeAmount: (text: string) => void, onChangeUnit: (unit: string) => void }} props
 */
export default function PriceField({ label, amount, unit, onChangeAmount, onChangeUnit }) {
  const rupees = toRupees(amount, unit);
  return (
    <View>
      <Field
        label={label}
        keyboardType="decimal-pad"
        placeholder={unit === 'Cr' ? '1.25' : '85'}
        value={amount}
        onChangeText={onChangeAmount}
        error={amount !== '' && !(rupees > 0) ? 'Enter a number, e.g. 85 or 1.25' : undefined}
      />
      <View style={styles.units}>
        <ChipRow options={PRICE_UNITS} value={unit} onSelect={onChangeUnit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  units: { marginTop: spacing.sm },
});
