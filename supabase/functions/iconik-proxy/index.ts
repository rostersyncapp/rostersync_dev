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

        // --- LOGIN ACTION ---
        if (action === 'login') {
            if (!username || !password || !appId) {
                return new Response(
                    JSON.stringify({ error: 'Missing username, password, or appId' }),
                    {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    }
                )
            }

            console.log(`Proxying login request for user: ${username}, AppID: ${appId}`);

            const loginUrl = 'https://app.iconik.io/API/auth/v1/auth/simple/login/';
            const loginHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'App-ID': appId
            };

            if (authToken) {
                loginHeaders['Auth-Token'] = authToken;
            }

            const response = await fetch(loginUrl, {
                method: 'POST',
                headers: loginHeaders,
                body: JSON.stringify({ email: username, password: password, app_name: 'RosterSync' })
            });

            let data = await response.json().catch(e => ({ error: 'Failed to parse JSON', details: e.message }));

            // Inject Header Token into Body if present
            const headerToken = response.headers.get('Auth-Token');
            if (headerToken) {
                if (typeof data !== 'object' || data === null) {
                    data = { response_body: data };
                }
                data.auth_token = headerToken;
            }

            // Handle System Domains response (Enterprise Auth)
            if (data.auth_system_domains && Array.isArray(data.auth_system_domains) && data.auth_system_domains.length > 0) {
                console.log('Detected System Domains Auth response');
                const firstDomain = data.auth_system_domains[0];
                if (firstDomain.token) {
                    console.log(`Extracted token from system domain: ${firstDomain.system_domain_name}`);
                    data.token = firstDomain.token;
                    data.app_id = loginHeaders['App-ID']; // Ensure App-ID is passed back if needed
                }
            }

            if (!response.ok) {
                console.log('Login failed upstream:', response.status, data);
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

        // --- DEFAULT ACTION: CHECK CONNECTION ---
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
        const headers: Record<string, string> = {
            'App-ID': appId,
            'Auth-Token': authToken,
            'Accept': 'application/json'
        };

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
