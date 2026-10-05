import 'dotenv/config';

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT || 4100),
  dashboardOrigin: process.env.DASHBOARD_ORIGIN || 'http://localhost:5183',

  supabaseUrl: () => required('SUPABASE_URL'),
  supabaseServiceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),

  namecheap: {
    apiBase: process.env.NAMECHEAP_API_BASE || 'https://api.sandbox.namecheap.com/xml.response',
    apiUser: process.env.NAMECHEAP_API_USER,
    apiKey: process.env.NAMECHEAP_API_KEY,
    username: process.env.NAMECHEAP_USERNAME,
    clientIp: process.env.NAMECHEAP_CLIENT_IP,
    isConfigured() {
      return Boolean(this.apiUser && this.apiKey && this.username && this.clientIp);
    },
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    isConfigured() {
      return Boolean(this.secretKey);
    },
  },

  dnsMarkupRate: Number(process.env.DNS_MARKUP_RATE || 0.4),
};
