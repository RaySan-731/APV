const fetch = global.fetch || require('node-fetch');

const MPESA_ENV = process.env.MPESA_ENV === 'production' ? 'production' : 'sandbox';
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY?.trim();
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET?.trim();
const MPESA_SHORTCODE = (process.env.MPESA_SHORTCODE || process.env.MPESA_TILL || '').trim();
const MPESA_PASSKEY = process.env.MPESA_PASSKEY?.trim();
const CALLBACK_URL = process.env.MPESA_STK_CALLBACK_URL?.trim() || null;

const MPESA_BASE_URL = MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

class MpesaService {
  static async getAccessToken() {
    if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
      throw new Error('MPESA consumer credentials are not configured');
    }

    const tokenUrl = `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');

    const response = await fetch(tokenUrl, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`MPESA auth failed: ${response.status} ${body}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  static formatPhoneNumber(phoneNumber) {
    const digits = phoneNumber.toString().replace(/\D/g, '');
    if (/^2547\d{8}$/.test(digits)) return digits;
    if (/^07\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
    if (/^7\d{8}$/.test(digits)) return `254${digits}`;
    return null;
  }

  static generatePassword(shortcode, passkey, timestamp) {
    return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  }

  static isValidCallbackUrl(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch (err) {
      return false;
    }
  }

  static async initiateStkPush({ phoneNumber, amount, accountReference, transactionDesc }) {
    if (!MPESA_SHORTCODE || !MPESA_PASSKEY) {
      return { success: false, error: 'MPESA shortcode or passkey is not configured' };
    }

    if (!this.isValidCallbackUrl(CALLBACK_URL)) {
      return {
        success: false,
        error: `Invalid MPESA_STK_CALLBACK_URL configuration. It must be a full URL including http:// or https://. Current value: ${CALLBACK_URL}`
      };
    }

    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      return { success: false, error: 'Invalid Kenyan phone number' };
    }

    const accessToken = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const password = this.generatePassword(MPESA_SHORTCODE, MPESA_PASSKEY, timestamp);

    const body = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: parseInt(amount, 10),
      PartyA: formattedPhone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: CALLBACK_URL,
      AccountReference: accountReference || 'SCOUTMATE',
      TransactionDesc: transactionDesc || 'Invoice payment'
    };

    const response = await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok || data.ResponseCode !== '0') {
      return {
        success: false,
        error: data.errorMessage || data.error || data.ResponseDescription || 'MPESA STK request failed',
        data
      };
    }

    return { success: true, data };
  }
}

module.exports = MpesaService;
