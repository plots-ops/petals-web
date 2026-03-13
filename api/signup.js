export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { customerName, customerEmail, customerPhone, customerCity, selectedPlanId, selectedPriceId } = req.body;

  // Validate required fields
  if (!customerName || !customerEmail || !customerPhone || !customerCity || !selectedPlanId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const response = await fetch(
      `https://app.base44.com/api/apps/${process.env.BASE44_APP_ID}/entities/Customer`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apiKey': process.env.BASE44_API_KEY,
        },
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          customerCity,
          selectedPlanId,
          selectedPriceId: selectedPriceId || selectedPlanId,
          smsOptIn: true,
          creditBalance: 0,
          recipients: [],
          notificationPreferences: {
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
