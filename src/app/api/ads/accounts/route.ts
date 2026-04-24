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
    const config = await prisma.googleCredential.findUnique({
      where: { mainAccountId }
    });

    if (!config || !config.accessToken) {
      return NextResponse.json({ error: 'Google Ads not configured' }, { status: 401 });
    }

    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      return NextResponse.json({ 
        error: 'DEVELOPER_TOKEN_MISSING',
        message: 'Please add GOOGLE_ADS_DEVELOPER_TOKEN to your .env file' 
      }, { status: 500 });
    }

    console.log('Fetching accounts for MainAccount:', mainAccountId);
    console.log('Using Developer Token:', developerToken?.substring(0, 5) + '...');

    const getResourceNames = async (token: string) => {
      const client = new GoogleAdsApi({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        developer_token: developerToken,
      });
      return await client.listAccessibleCustomers(token);
    };

    try {
      let resourceNames;
      try {
        resourceNames = await getResourceNames(config.accessToken!);
      } catch (err: any) {
        // If it fails and we have a refresh token, try to refresh and retry once
        if (config.refreshToken) {
          console.log('Access token might be expired, attempting refresh...');
          const { getGoogleOAuthClient } = await import('@/lib/googleAuth');
          const oauth2Client = getGoogleOAuthClient();
          oauth2Client.setCredentials({ refresh_token: config.refreshToken });
          
          const { credentials } = await oauth2Client.refreshAccessToken();
          const newAccessToken = credentials.access_token!;
          
          // Update database with new token
          await prisma.googleCredential.update({
            where: { mainAccountId },
            data: { 
              accessToken: newAccessToken,
              expiresAt: credentials.expiry_date
            }
          });
          
          console.log('Token refreshed successfully, retrying...');
          resourceNames = await getResourceNames(newAccessToken);
        } else {
          throw err;
        }
      }

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
            access_token: config.accessToken!,
            refresh_token: config.refreshToken || undefined
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
    } catch (apiError: any) {
      console.error('Google Ads API specific error:', JSON.stringify(apiError, null, 2));
      throw apiError;
    }
  } catch (error: any) {
    console.error('Failed to fetch Google Ads accounts:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch accounts', 
      details: error.message,
      fullError: error
    }, { status: 500 });
  }
}
