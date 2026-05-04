import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleAdsApi } from 'google-ads-api';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');

  if (!mainAccountId) {
    return NextResponse.json({ error: 'mainAccountId is required' }, { status: 400 });
  }

  try {
    const { withGoogleAuth } = await import('@/lib/googleAuth');

    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      return NextResponse.json({ 
        error: 'DEVELOPER_TOKEN_MISSING',
        message: 'Please add GOOGLE_ADS_DEVELOPER_TOKEN to your .env file' 
      }, { status: 500 });
    }

    return await withGoogleAuth(mainAccountId, async (oauth2Client) => {
      const getResourceNames = async (token: string) => {
        const client = new GoogleAdsApi({
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          developer_token: developerToken,
        });
        return await client.listAccessibleCustomers(token);
      };

      const tokens = await oauth2Client.getAccessToken();
      const resourceNames = await getResourceNames(tokens.token!);

      if (!resourceNames) {
        throw new Error('Could not fetch resource names');
      }

      const namesArray = Array.isArray(resourceNames) 
        ? resourceNames 
        : (resourceNames as any).resource_names || [];
      
      // Parallelize fetching details for all accounts
      const customerPromises = namesArray.map(async (rn: string) => {
        try {
          const customerId = rn.split('/')[1];
          const customerClient = new GoogleAdsApi({
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            developer_token: developerToken,
          }).Customer({
            customer_id: customerId,
            access_token: tokens.token!,
            refresh_token: oauth2Client.credentials.refresh_token || undefined
          });

          const details = await customerClient.report({
            entity: 'customer',
            attributes: [
              'customer.id', 
              'customer.descriptive_name', 
              'customer.resource_name',
              'customer.status'
            ],
          });

          if (details && details.length > 0) {
            const customerData = details[0].customer;
            const isEnabled = customerData.status === 'ENABLED' || customerData.status === 2;
            
            if (isEnabled) {
              return {
                id: customerId,
                name: customerData.descriptive_name || customerData.resource_name || 'Unnamed Account',
                resourceName: rn
              };
            }
          }
          return null;
        } catch (e) {
          console.error(`Failed to fetch name for ${rn}:`, e);
          return { id: rn.split('/')[1], name: 'Unnamed Account', resourceName: rn };
        }
      });

      const results = await Promise.all(customerPromises);
      const customers = results.filter((c): c is any => c !== null);

      return NextResponse.json({ customers });
    });
  } catch (error: any) {
    console.error('Failed to fetch Google Ads accounts:', error);
    
    const authErrors = ['NOT_CONFIGURED', 'REFRESH_FAILED', 'REFRESH_TOKEN_MISSING'];
    if (authErrors.includes(error.message) || error.code === 401 || (error.response && error.response.status === 401)) {
      return NextResponse.json({ 
        error: 'Google Ads authentication failed', 
        code: 'AUTH_REQUIRED',
        details: error.message 
      }, { status: 401 });
    }

    return NextResponse.json({ 
      error: 'Failed to fetch accounts', 
      details: error.message,
    }, { status: 500 });
  }
}
