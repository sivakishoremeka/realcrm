import { Alert, Linking, Share } from 'react-native';
import { formatPrice } from '../components/PriceField';

export function buildPropertyShareText(property, agentPhone = '') {
  const price =
    property?.price != null ? formatPrice(property.price) : 'Price on request';
  const lines = [
    `🏠 ${property?.title || 'Property listing'}`,
    `${property?.type || ''} · ${property?.listingType || ''}`.trim(),
    property?.bhk != null ? `${property.bhk} BHK` : null,
    `Location: ${property?.zone?.name || 'Hyderabad'}`,
    property?.address ? `Address: ${property.address}` : null,
    `Price: ${price}`,
    property?.notes ? `Notes: ${property.notes}` : null,
    agentPhone ? `Contact: ${agentPhone}` : null,
    '',
    'Shared via Your Bhoomi',
  ].filter(Boolean);
  return lines.join('\n');
}

async function openWhatsAppMessage(text, phone = '') {
  const encoded = encodeURIComponent(text);
  const digits = String(phone || '').replace(/\D/g, '');
  const appUrl = digits
    ? `whatsapp://send?phone=${digits}&text=${encoded}`
    : `whatsapp://send?text=${encoded}`;
  const webUrl = digits
    ? `https://wa.me/${digits}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  try {
    const canOpen = await Linking.canOpenURL(appUrl);
    if (canOpen) {
      await Linking.openURL(appUrl);
      return;
    }
    await Linking.openURL(webUrl);
  } catch {
    try {
      await Share.share({ message: text });
    } catch (err) {
      Alert.alert('Share failed', err.message || 'Could not open WhatsApp');
    }
  }
}

export async function sharePropertyOnWhatsApp(property, agentPhone = '') {
  await openWhatsAppMessage(buildPropertyShareText(property, agentPhone));
}

export function buildLeadShareText(requirement, agentName = '') {
  const budgetMin = requirement?.budgetMin || 0;
  const budgetMax = requirement?.budgetMax;
  const budget =
    budgetMax != null
      ? `${formatPrice(budgetMin)} – ${formatPrice(budgetMax)}`
      : budgetMin
        ? `From ${formatPrice(budgetMin)}`
        : 'Open';
  const zones =
    (requirement?.preferredZones || []).map((z) => z.name).join(', ') || 'Any Hyderabad zone';
  const greeting = agentName ? `Hi ${agentName},\n\n` : '';
  return [
    `${greeting}Buyer care request via Your Bhoomi — please help this buyer.`,
    `Buyer: ${requirement?.customer?.name || 'Lead'}`,
    requirement?.customer?.phone ? `Phone: ${requirement.customer.phone}` : null,
    `Need: ${requirement?.propertyType || 'Any'} · ${requirement?.listingType || ''}`,
    requirement?.bhkMin != null || requirement?.bhkMax != null
      ? `BHK: ${requirement?.bhkMin ?? '?'}–${requirement?.bhkMax ?? '?'}`
      : null,
    `Budget: ${budget}`,
    `Preferred locations: ${zones}`,
    requirement?.notes ? `Notes: ${requirement.notes}` : null,
    '',
    'Goal: serve the buyer well and keep them happy.',
    'Shared via Your Bhoomi',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function shareLeadRequestOnWhatsApp(requirement, agent = {}) {
  const text = buildLeadShareText(requirement, agent.name);
  await openWhatsAppMessage(text, agent.phone || '');
}
