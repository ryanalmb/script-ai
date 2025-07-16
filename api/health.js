export default function handler(req, res) {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Telegram Bot Webhook',
    platform: 'Vercel'
  });
}
