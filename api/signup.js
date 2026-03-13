export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    customerName,
    customerEmail,
    customerPhone,
    customerCity,
    selectedPlanId,
    selectedPriceId,
    smsOptIn,
    recipients,
    notificationPreferences,
  } = req.body;

  // Validate required fields
  if (!customerName || !customerEmail || !customerPhone || !customerCity || !selectedPlanId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // ── Twilio Lookup: normalize phone number to E.164 ──────────────────────
    let normalizedPhone = customerPhone;

    try {
      const lookupUrl = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(customerPhone)}`;
      const lookupResponse = await fetch(lookupUrl, {
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(
              `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
            ).toString('base64'),
        },
      });

      if (lookupResponse.ok) {
        const lookupData = await lookupResponse.json();
        if (lookupData.phone_number) {
          normalizedPhone = lookupData.phone_number; // E.164 format e.g. +14155550100
        }
      } else {
        // Lookup failed — log but don't block signup
        console.warn('Twilio Lookup failed for:', customerPhone, await lookupResponse.text());
      }
    } catch (lookupErr) {
      // Network error on Lookup — log but don't block signup
      console.warn('Twilio Lookup error:', lookupErr.message);
    }

    // ── Save customer to Base44 ──────────────────────────────────────────────
    const response = await fetch(
      `https://app.base44.com/api/apps/${process.env.BASE44_APP_ID}/entities/Customer`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apiKey: process.env.BASE44_API_KEY,
        },
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone: normalizedPhone,
          customerCity,
          selectedPlanId,
          selectedPriceId: selectedPriceId || selectedPlanId,
          smsOptIn: smsOptIn ?? true,
          creditBalance: 0,
          recipients: recipients || [],
          notificationPreferences: notificationPreferences || {
            smsWeekBefore: true,
            smsDayOf: true,
            smsRestaurantSuggestions: true,
            smsPromotions: false,
            smsOrderConfirmation: true,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Base44 error:', data);
      return res.status(500).json({ error: 'Failed to create customer' });
    }

    return res.status(200).json({ success: true, customerId: data.id });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
