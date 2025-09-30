// src/pages/api/powerbi-token.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  try {
    // Access environment variables (Astro makes these available)
    const clientId = import.meta.env.POWER_BI_CLIENT_ID;
    const tenantId = import.meta.env.POWER_BI_TENANT_ID;
    const clientSecret = import.meta.env.POWER_BI_CLIENT_SECRET;
    const workspaceId = import.meta.env.POWER_BI_WORKSPACE_ID;
    const reportId = import.meta.env.POWER_BI_REPORT_ID;

    // Validate required environment variables
    if (!clientId || !tenantId || !clientSecret || !workspaceId || !reportId) {
      return new Response(
        JSON.stringify({ error: 'Power BI configuration is incomplete' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 1: Get an access token for Power BI from Azure AD
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const scope = 'https://analysis.windows.net/powerbi/api/.default';

    const body = new URLSearchParams();
    body.append('client_id', clientId);
    body.append('client_secret', clientSecret);
    body.append('grant_type', 'client_credentials');
    body.append('scope', scope);

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get Azure AD token: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Step 2: Generate embed token using Power BI API
    const embedTokenUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/GenerateToken`;
    
    const embedResponse = await fetch(embedTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessLevel: 'View',
        allowSaveAs: false,
      }),
    });

    if (!embedResponse.ok) {
      throw new Error(`Failed to generate embed token: ${embedResponse.statusText}`);
    }

    const embedData = await embedResponse.json();
    
    const embedUrl = `https://app.powerbi.com/reportEmbed?reportId=${reportId}&groupId=${workspaceId}`;

    return new Response(
      JSON.stringify({
        embedToken: embedData.token,
        embedUrl: embedUrl,
        reportId: reportId,
        expiry: embedData.expiration,
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        },
      }
    );

  } catch (error) {
    console.error('Power BI token generation error:', error);
    
    // Safe error message extraction
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate Power BI embed token',
        details: errorMessage
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};