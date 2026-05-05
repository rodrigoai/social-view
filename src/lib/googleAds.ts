import { GoogleAdsApi } from 'google-ads-api';

export function getGoogleAdsClient(accessToken: string, refreshToken?: string) {
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
  });

  return client.Customer({
    customer_id: '',
    refresh_token: refreshToken as string,
  });
}

export function getCustomer(accessToken: string, customerId: string, refreshToken?: string) {
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
  });

  return client.Customer({
    customer_id: customerId.replace(/-/g, ''),
    refresh_token: refreshToken as string,
  });
}
