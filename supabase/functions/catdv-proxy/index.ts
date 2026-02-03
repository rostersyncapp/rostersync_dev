import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

// Helper to construct response with CORS
const createResponse = (body: any, status = 200) => {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

Deno.serve(async (req) => {
    const reqId = Math.random().toString(36).substring(7);
    console.log(`[${reqId}] Request received: ${req.method} ${req.url}`);

    if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200, headers: corsHeaders });
    }

    try {
        const body = await req.json().catch(e => {
            console.warn(`[${reqId}] Failed to parse request body:`, e.message);
            return null;
        });

        if (!body) {
            return createResponse({ error: 'Invalid or missing JSON body' }, 400);
        }

        const { action, server, username, password, sessionId, fieldName, options: newOptions } = body;

        if (!server) {
            return createResponse({ error: 'Missing server address' }, 400);
        }

        // --- NORMALIZE SERVER URL ---
        let baseUrl = server.trim();
        if (!baseUrl.startsWith('http')) baseUrl = `http://${baseUrl}`;
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

        // Standard CatDV base: http://server:8080/catdv
        let catdvBase = baseUrl;
        if (!catdvBase.includes('/catdv')) catdvBase = `${catdvBase}/catdv`;
        const apiBase = `${catdvBase}/api`;

        console.log(`[${reqId}] Base URL: ${baseUrl}, API Base: ${apiBase}`);

        let activeSessionId = sessionId;

        // --- LOGIN IF NO SESSION ID ---
        if (!activeSessionId && username && password) {
            console.log(`[${reqId}] Attempting login to: ${apiBase}/session`);

            // Try POST first (modern CatDV)
            try {
                const loginRes = await fetch(`${apiBase}/session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const loginText = await loginRes.text();
                console.log(`[${reqId}] Login response status: ${loginRes.status}`);

                if (loginRes.ok) {
                    const loginData = JSON.parse(loginText);
                    activeSessionId = loginData.id || loginData.sessionId || loginData.jSessionId;
                    console.log(`[${reqId}] Login successful, session: ${activeSessionId}`);
                } else {
                    // If POST fails, try GET (legacy CatDV)
                    console.log(`[${reqId}] POST login failed, trying legacy GET login...`);
                    const legacyUrl = `${apiBase}/session?usr=${encodeURIComponent(username)}&pwd=${encodeURIComponent(password)}`;
                    const legacyRes = await fetch(legacyUrl);
                    const legacyText = await legacyRes.text();

                    if (legacyRes.ok) {
                        const legacyData = JSON.parse(legacyText);
                        activeSessionId = legacyData.id || legacyData.sessionId || legacyData.jSessionId;
                        console.log(`[${reqId}] Legacy login successful, session: ${activeSessionId}`);
                    } else {
                        console.error(`[${reqId}] Both login methods failed. Status: ${legacyRes.status}`);
                        return createResponse({ error: 'CatDV Login Failed', details: legacyText }, 401);
                    }
                }
            } catch (err: any) {
                console.error(`[${reqId}] Network error during login:`, err.message);
                return createResponse({ error: 'Connection to CatDV failed', details: err.message }, 500);
            }
        }

        if (!activeSessionId) {
            return createResponse({ error: 'Missing session. Please provide credentials.' }, 401);
        }

        if (action === 'login') {
            return createResponse({ success: true, sessionId: activeSessionId });
        }

        // --- SYNC PICKLIST ACTION ---
        if (action === 'sync_catdv_picklist') {
            if (!fieldName || !Array.isArray(newOptions)) {
                return createResponse({ error: 'Missing fieldName or options array' }, 400);
            }

            console.log(`[${reqId}] Syncing picklist for field: ${fieldName}`);

            // Research says: PUT /catdv/api/admin/v1/fields/{fieldId}/list
            // Note: We might need to try multiple path variations
            const variations = [
                `${apiBase}/admin/v1/fields/${fieldName}/list`,
                `${apiBase}/admin/fields/${fieldName}/list`,
                `${apiBase}/fields/${fieldName}/list`
            ];

            let lastError = null;
            for (const putUrl of variations) {
                console.log(`[${reqId}] Trying PUT to: ${putUrl}`);

                try {
                    const response = await fetch(putUrl, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `JSESSIONID=${activeSessionId}`
                        },
                        body: JSON.stringify({
                            values: newOptions,
                            isExtensible: false,
                            isKeptSorted: true,
                            savesValues: false,
                            isLocked: true
                        })
                    });

                    const resText = await response.text();
                    console.log(`[${reqId}] Response [${response.status}] from ${putUrl}`);

                    if (response.ok) {
                        let resData = {};
                        try { resData = JSON.parse(resText); } catch (e) { }
                        return createResponse({ success: true, data: resData, method: putUrl });
                    }

                    lastError = { status: response.status, body: resText, url: putUrl };

                    if (response.status === 401) {
                        console.warn(`[${reqId}] Session expired or invalid at ${putUrl}`);
                    }
                } catch (e: any) {
                    console.error(`[${reqId}] Error calling ${putUrl}:`, e.message);
                    lastError = { error: e.message, url: putUrl };
                }
            }

            return createResponse({
                error: 'CatDV Sync Failed after trying all path variations',
                details: lastError
            }, lastError?.status || 500);
        }

        return createResponse({ error: 'Unsupported action' }, 400);

    } catch (error: any) {
        console.error(`[${reqId}] Global Error:`, error.message);
        return createResponse({ error: error.message }, 500);
    }
})
