export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    to_phone,           // recipient's customer phone in E.164 format
    sender_first_name,  // customer's first name
    recipient_first_name,
    recipient_last_name,
    occasion_type,      // e.g. "birthday", "anniversary"
    occasion_date,      // e.g. "2026-04-15"
    reminder_timing,    // e.g. "1_week", "day_of"
  } = req.body;

  // Validate required fields
  if (!to_phone || !sender_first_name || !recipient_first_name || !occasion_type || !reminder_timing) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Twilio credentials from environment variables
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken) {
    return res.status(500).json({ error: 'Twilio credentials not configured' });
  }

  // --- Build message from template ---
  const templates = {
    birthday: {
      '1_month': `Hi {{sender_first_name}}, just a heads up — {{recipient_first_name}} {{recipient_last_name}}'s birthday is one month away on {{occasion_date}}. Plenty of time to make it unforgettable. Plan at petalsandpackages.com 🌸`,
      '2_weeks': `Hi {{sender_first_name}}, {{recipient_first_name}}'s birthday is two weeks away on {{occasion_date}}. Order flowers or find a restaurant at petalsandpackages.com 🌸`,
      '1_week':  `Hi {{sender_first_name}}, {{recipient_first_name}} {{recipient_last_name}}'s birthday is one week away on {{occasion_date}}. Don't let it sneak up on you — petalsandpackages.com 🌸`,
      'day_of':  `🎂 Today is {{recipient_first_name}}'s birthday! Make it special — send flowers or book a table at petalsandpackages.com 🌸`,
    },
    anniversary: {
      '1_month': `Hi {{sender_first_name}}, your anniversary with {{recipient_first_name}} is one month away on {{occasion_date}}. Start planning something special at petalsandpackages.com 🌸`,
      '2_weeks': `Hi {{sender_first_name}}, your anniversary with {{recipient_first_name}} is two weeks away on {{occasion_date}}. Flowers or a great dinner? petalsandpackages.com 🌸`,
      '1_week':  `Hi {{sender_first_name}}, your anniversary with {{recipient_first_name}} is one week away on {{occasion_date}}. Make it count — petalsandpackages.com 🌸`,
      'day_of':  `💍 Today is your anniversary with {{recipient_first_name}}! Celebrate in style — petalsandpackages.com 🌸`,
    },
    mothers_day: {
      '2_weeks': `Hi {{sender_first_name}}, Mother's Day is two weeks away on {{occasion_date}}. Show {{recipient_first_name}} how much she means to you — petalsandpackages.com 🌸`,
      '1_week':  `Hi {{sender_first_name}}, Mother's Day is one week away on {{occasion_date}}. Send {{recipient_first_name}} flowers she'll love — petalsandpackages.com 🌸`,
      'day_of':  `🌷 Happy Mother's Day! Don't forget to make {{recipient_first_name}} feel special today — petalsandpackages.com 🌸`,
    },
    fathers_day: {
      '2_weeks': `Hi {{sender_first_name}}, Father's Day is two weeks away on {{occasion_date}}. Make it a memorable one for {{recipient_first_name}} — petalsandpackages.com 🌸`,
      '1_week':  `Hi {{sender_first_name}}, Father's Day is one week away on {{occasion_date}}. Plan something great for {{recipient_first_name}} at petalsandpackages.com 🌸`,
      'day_of':  `🎉 Happy Father's Day! Show {{recipient_first_name}} some love today — petalsandpackages.com 🌸`,
    },
    valentines_day: {
      '1_month': `Hi {{sender_first_name}}, Valentine's Day is one month away on {{occasion_date}}. Beat the rush and plan something unforgettable for {{recipient_first_name}} — petalsandpackages.com 🌸`,
      '2_weeks': `Hi {{sender_first_name}}, Valentine's Day is two weeks away on {{occasion_date}}. Flowers, dinner, or both? petalsandpackages.com 🌸`,
      '1_week':  `Hi {{sender_first_name}}, Valentine's Day is one week away on {{occasion_date}}. Make it special for {{recipient_first_name}} — petalsandpackages.com 🌸`,
      'day_of':  `💝 Happy Valentine's Day! Make {{recipient_first_name}} feel loved today — petalsandpackages.com 🌸`,
    },
  };

  const occasionTemplates = templates[occasion_type];
  if (!occasionTemplates) {
    return res.status(400).json({ error: `No templates found for occasion type: ${occasion_type}` });
  }

  const template = occasionTemplates[reminder_timing];
  if (!template) {
    return res.status(400).json({ error: `No template found for timing: ${reminder_timing}` });
  }

  // Format occasion date nicely
  const formattedDate = occasion_date
    ? new Date(occasion_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : '';

  // Merge template tags
  const messageBody = template
    .replace(/{{sender_first_name}}/g, sender_first_name)
    .replace(/{{recipient_first_name}}/g, recipient_first_name)
    .replace(/{{recipient_last_name}}/g, recipient_last_name || '')
    .replace(/{{occasion_date}}/g, formattedDate)
    .replace(/{{occasion_type}}/g, occasion_type);

  // --- Send via Twilio ---
  try {
    const twilioPayload = new URLSearchParams({
      To: to_phone,
      Body: messageBody,
    });

    // Use Messaging Service SID if available, otherwise fall back to From number
    if (messagingServiceSid) {
      twilioPayload.append('MessagingServiceSid', messagingServiceSid);
    } else {
      twilioPayload.append('From', fromNumber);
    }

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
        body: twilioPayload.toString(),
      }
    );

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioData);
      return res.status(500).json({
        error: 'Twilio send failed',
        detail: twilioData.message,
        code: twilioData.code,
      });
    }

    return res.status(200).json({
      success: true,
      messageSid: twilioData.sid,
      status: twilioData.status,
      to: twilioData.to,
    });

  } catch (err) {
    console.error('Send reminder error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
