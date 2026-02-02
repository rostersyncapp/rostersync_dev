import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { appId, authToken } = await req.json()

        if (!appId || !authToken) {
            return new Response(
                JSON.stringify({ error: 'Missing appId or authToken' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        console.log(`Proxying request to Iconik for AppID: ${appId.substring(0, 5)}...`);

        // Removed /v1/ prefix as it seems to cause 404s for some tenants
        const iconikUrl = 'https://app.iconik.io/API/users/current/';

        // Explicitly construct headers object
        const headers = new Headers();
        headers.append('App-ID', appId);
        headers.append('Auth-Token', authToken);
        headers.append('Accept', 'application/json');

        const response = await fetch(iconikUrl, {
            method: 'GET',
            headers: headers,
        })

        const data = await response.json().catch(e => ({ error: 'Failed to parse JSON', details: e.message }));

        console.log(`Iconik Response Status: ${response.status}`);

        if (!response.ok) {
            return new Response(
                JSON.stringify({
                    error: 'Iconik API Error',
                    status: response.status,
                    upstream_data: data
                }),
                {
                    status: response.status,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        return new Response(
            JSON.stringify(data),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    } catch (error) {
        console.error('Edge Function Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})
