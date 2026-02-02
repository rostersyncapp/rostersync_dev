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
        const { action, username, password, appId, authToken } = await req.json()

        if (action === 'login') {
            if (!username || !password) {
                return new Response(
                    JSON.stringify({ error: 'Missing username or password' }),
                    {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    }
                )
            }

            console.log(`Proxying login request for user: ${username}`);
            const response = await fetch('https://app.iconik.io/API/v1/auth/simple/login/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ email: username, password: password, app_name: 'RosterSync' })
            });

            const data = await response.json().catch(e => ({ error: 'Failed to parse JSON', details: e.message }));

            if (!response.ok) {
                return new Response(
                    JSON.stringify({
                        error: 'Iconik Login Failed',
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
        }

        // Default: Check Connection (User Info)
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
        const iconikUrl = 'https://app.iconik.io/API/users/current/';
        const headers = new Headers();
        headers.append('App-ID', appId);
        headers.append('Auth-Token', authToken);
        headers.append('Accept', 'application/json');

        const response = await fetch(iconikUrl, {
            method: 'GET',
            headers: headers,
        })

        const data = await response.json().catch(e => ({ error: 'Failed to parse JSON', details: e.message }));

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
