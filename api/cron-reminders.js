export const config = { maxDuration: 60 };

const BASE44_API   = `https://app.base44.com/api/apps/${process.env.BASE44_INTERNAL_APP_ID}/entities`;
const BASE44_HEADS = { 'Content-Type': 'application/json', 'apiKey': process.env.BASE44_API_KEY };
const SITE_URL     = process.env.SITE_URL || 'https://petalsandpackages.com';

// How many days ahead each reminder_timing fires
const TIMING_DAYS = {
  '1_month': 30,
  '2_weeks': 14,
  '1_week':  7,
  'day_of':  0,
};

export default async function handler(req, res) {
  // Vercel cron jobs send GET requests — allow GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional security check — Vercel passes this header on cron calls
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const results = { sent: 0, skipped: 0, errors: [] };

  try {
    // Fetch all active customers from the main P&P app
    const customersRes = await fetch(
      `https://app.base44.com/api/apps/${process.env.BASE44_APP_ID}/entities/Customer?limit=500`,
      { headers: { 'Content-Type': 'application/json', 'apiKey': process.env.BASE44_API_KEY } }
    );
    const customersData = await customersRes.json();
    const customers = customersData.entities || [];

    for (const customer of customers) {
      if (!customer.smsOptIn || !customer.customerPhone) continue;
      if (!customer.recipients || customer.recipients.length === 0) continue;

      const senderFirstName = customer.customerName?.split(' ')[0] || 'there';

      for (const recipient of customer.recipients) {
        if (!recipient.occasions || recipient.occasions.length === 0) continue;

        const recipientFirstName = recipient.recipientName?.split(' ')[0] || recipient.recipientName;
        const recipientLastName  = recipient.recipientName?.split(' ').slice(1).join(' ') || '';

        for (const occasion of recipient.occasions) {
          if (!occasion.occasionDate || !occasion.occasionType) continue;

          // Calculate this year's occurrence of the occasion
          const [occYear, occMonth, occDay] = occasion.occasionDate.split('-').map(Number);
          let occasionThisYear = new Date(today.getFullYear(), occMonth - 1, occDay);

          // If it already passed this year, look at next year
          if (occasionThisYear < today) {
            occasionThisYear = new Date(today.getFullYear() + 1, occMonth - 1, occDay);
          }

          // Check each reminder timing
          for (const [timing, daysAhead] of Object.entries(TIMING_DAYS)) {
            const reminderDate = new Date(occasionThisYear);
            reminderDate.setDate(reminderDate.getDate() - daysAhead);
            reminderDate.setHours(0, 0, 0, 0);

            // Only fire if today is the reminder date
            if (reminderDate.getTime() !== today.getTime()) continue;

            // Check notification preferences
            const prefs = customer.notificationPreferences || {};
            if (daysAhead === 7 && prefs.smsWeekBefore === false) continue;
            if (daysAhead === 0 && prefs.smsDayOf === false) continue;

            // Fire the SMS
            try {
              const smsRes = await fetch(`${SITE_URL}/api/send-reminder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to_phone:             customer.customerPhone,
                  sender_first_name:    senderFirstName,
                  recipient_first_name: recipientFirstName,
                  recipient_last_name:  recipientLastName,
                  occasion_type:        occasion.occasionType.toLowerCase().replace(' ', '_'),
                  occasion_date:        occasion.occasionDate,
                  reminder_timing:      timing,
                }),
              });

              const smsData = await smsRes.json();

              if (smsRes.ok && smsData.success) {
                results.sent++;

                // Log to ReminderLog in Internal Dashboard
                await fetch(`${BASE44_API}/ReminderLog`, {
                  method: 'POST',
                  headers: BASE44_HEADS,
                  body: JSON.stringify({
                    occasion_type:   occasion.occasionType,
                    occasion_date:   occasion.occasionDate,
                    reminder_type:   'sms',
                    sent_at:         new Date().toISOString(),
                    message_content: `${timing} reminder sent to ${customer.customerPhone}`,
                    delivery_status: 'sent',
                    triggered_by:    'system',
                  }),
                });
              } else {
                results.errors.push({
                  customer: customer.customerName,
                  recipient: recipient.recipientName,
                  timing,
                  error: smsData.error || 'Unknown error',
                });
              }
            } catch (err) {
              results.errors.push({
                customer: customer.customerName,
                recipient: recipient.recipientName,
                timing,
                error: err.message,
              });
            }
          }
        }
      }
    }

    console.log('Cron completed:', results);
    return res.status(200).json({ success: true, date: today.toISOString().split('T')[0], ...results });

  } catch (err) {
    console.error('Cron error:', err);
    return res.status(500).json({ error: 'Cron failed', detail: err.message });
  }
}
