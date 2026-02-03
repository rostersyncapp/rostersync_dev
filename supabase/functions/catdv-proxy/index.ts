import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            status: 200,
            headers: corsHeaders
        })
    }

    try {
        const body = await req.json();
        const { action, server, username, password, sessionId, fieldName, options: newOptions } = body;

        if (!server) {
            return new Response(JSON.stringify({ error: 'Missing server address' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Normalize server URL
        let baseUrl = server.trim();
        if (!baseUrl.startsWith('http')) baseUrl = `http://${baseUrl}`;
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

        // CatDV API base usually includes /api/v1
        const apiBase = `${baseUrl}/api/v1`;

        let activeSessionId = sessionId;

        // --- LOGIN IF NO SESSION ID ---
        if (!activeSessionId && username && password) {
            console.log(`Attempting login to CatDV at ${apiBase}/sessions`);
            try {
                const loginRes = await fetch(`${apiBase}/sessions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                if (loginRes.ok) {
                    const loginData = await loginRes.json();
                    activeSessionId = loginData.id || loginData.sessionId || loginData.jsessionid;
                    console.log('Login successful, obtained session:', activeSessionId);
                } else {
                    const errText = await loginRes.text();
                    console.error('Login failed:', loginRes.status, errText);
                    return new Response(JSON.stringify({ error: 'CatDV Login Failed', details: errText }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
            } catch (err: any) {
                console.error('Network error during login:', err);
                return new Response(JSON.stringify({ error: 'Connection to CatDV failed', details: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }

        if (!activeSessionId) {
            return new Response(JSON.stringify({ error: 'No active session. Please provide credentials or a session ID.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // --- EXPLICIT LOGIN ACTION ---
        if (action === 'login') {
            return new Response(JSON.stringify({ success: true, sessionId: activeSessionId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // --- SYNC PICKLIST ACTION ---
        if (action === 'sync_catdv_picklist') {
            if (!fieldName || !Array.isArray(newOptions)) {
                return new Response(JSON.stringify({ error: 'Missing fieldName or options array' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            console.log(`Syncing picklist for field: ${fieldName} on ${server}`);

            // 1. Get current field definition to see existing options (optional but good for merging)
            // Endpoint: GET /api/v1/admin/fields/{fieldId}
            // For now, we follow the "Sync Now" pattern: Replace entire list or add to it.
            // The Admin API often uses PUT /api/v1/admin/fields/{fieldId}/list to replace.

            const putUrl = `${apiBase}/admin/fields/${fieldName}/list`;
            console.log(`PUT request to: ${putUrl}`);

            const response = await fetch(putUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${activeSessionId}` // CatDV often accepts Bearer or Cookie
                },
                body: JSON.stringify({
                    values: newOptions
                })
            });

            // If Bearer fails, try Cookie
            if (response.status === 401) {
                console.log('Bearer auth failed, retrying with Cookie header...');
                const retryResponse = await fetch(putUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `JSESSIONID=${activeSessionId}`
                    },
                    body: JSON.stringify({
                        values: newOptions
                    })
                });

                if (retryResponse.ok) {
                    return new Response(JSON.stringify({ success: true, message: 'Sync successful (via Cookie)' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
            }

            const data = await response.json().catch(() => null);
            const text = !data ? await response.text().catch(() => 'No response body') : null;

            if (!response.ok) {
                console.error('Sync failed:', response.status, data || text);
                return new Response(JSON.stringify({
                    error: `CatDV Sync Failed (${response.status})`,
                    details: data || text
                }), {
                    status: response.status,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ error: 'Unsupported action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error('Edge Function Error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
})
