import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

const createResponse = (body: any, status = 200) => {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

function extractSessionId(obj: any): string | null {
    if (!obj || typeof obj !== 'object') return null;
    const keys = ['jsessionid', 'jSessionId', 'JSESSIONID', 'sessionId', 'id', 'token', 'accessToken'];
    for (const key of keys) {
        if (obj[key] && typeof obj[key] === 'string') return obj[key];
    }
    for (const key in obj) {
        if (typeof obj[key] === 'object') {
            const result = extractSessionId(obj[key]);
            if (result) return result;
        }
    }
    return null;
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

        if (!body) return createResponse({ error: 'Invalid or missing JSON body' }, 400);

        const { action, server, username, password, sessionId, fieldName, options: newOptions } = body;
        if (!server) return createResponse({ error: 'Missing server address' }, 400);

        let baseUrl = server.trim();
        if (!baseUrl.startsWith('http')) baseUrl = `http://${baseUrl}`;
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

        let catdvBase = baseUrl;
        if (!catdvBase.includes('/catdv')) catdvBase = `${catdvBase}/catdv`;
        const apiBase = `${catdvBase}/api`;

        console.log(`[${reqId}] Base URL: ${baseUrl}, API Base: ${apiBase}`);

        let activeSessionId = sessionId;

        // --- LOGIN ---
        if (!activeSessionId && username && password) {
            console.log(`[${reqId}] Starting login discovery...`);
            const variations = ['/catdv/api/1/session', '/api/1/session', '/catdv/api/session', '/api/session'];
            let found = false;

            for (const path of variations) {
                let loginUrl = baseUrl;
                if (path.startsWith('/catdv')) {
                    loginUrl = loginUrl.includes('/catdv') ? `${loginUrl}${path.slice(6)}` : `${loginUrl}${path}`;
                } else {
                    loginUrl = `${loginUrl}${path}`;
                }

                const commonHeaders = {
                    'User-Agent': 'PostmanRuntime/7.51.1',
                    'Accept': '*/*',
                    'ngrok-skip-browser-warning': 'true'
                };

                try {
                    const getUrl = `${loginUrl}${loginUrl.includes('?') ? '&' : '?'}usr=${encodeURIComponent(username)}&pwd=${encodeURIComponent(password)}`;
                    const res = await fetch(getUrl, { method: 'GET', headers: commonHeaders, redirect: 'follow' });
                    const text = await res.text();

                    if (text.includes('session limit') || text.includes('"status":"BUSY"')) {
                        return createResponse({ error: 'CatDV Session Limit Reached', details: text.slice(0, 100) }, 429);
                    }

                    if (res.ok) {
                        const setCookie = res.headers.get('set-cookie');
                        const cookieId = setCookie?.match(/JSESSIONID=([^;]+)/i)?.[1];
                        let jsonData = {};
                        try { jsonData = JSON.parse(text); } catch (e) { }
                        activeSessionId = cookieId || extractSessionId(jsonData);

                        if (activeSessionId) {
                            console.log(`[${reqId}] Login Success: ${activeSessionId}`);
                            found = true;
                            break;
                        }
                    }
                } catch (e) { console.error(`Login error at ${loginUrl}:`, e.message); }
            }
            if (!found) return createResponse({ error: 'CatDV Login Failed' }, 401);
        }

        if (!activeSessionId) return createResponse({ error: 'Missing session' }, 401);
        if (action === 'login') return createResponse({ success: true, sessionId: activeSessionId });

        // --- SYNC PICKLIST ---
        if (action === 'sync_catdv_picklist') {
            if (!fieldName || !Array.isArray(newOptions)) return createResponse({ error: 'Missing fieldName or options' }, 400);

            // 1. LOOKUP FIELD ID
            console.log(`[${reqId}] Looking up internal ID for field: ${fieldName}`);
            let internalFieldId = fieldName;
            let fieldInfo = {
                fieldGroupID: 1,
                memberOf: "clip",
                identifier: fieldName.includes('.') ? fieldName : `custom.${fieldName.toLowerCase().replace(/\s/g, '.')}`,
                name: fieldName
            };

            const lookupUrl = `${apiBase}/9/fields`;
            try {
                const lookupRes = await fetch(lookupUrl, {
                    headers: {
                        'Cookie': `JSESSIONID=${activeSessionId}`,
                        'ngrok-skip-browser-warning': 'true',
                        'User-Agent': 'PostmanRuntime/7.51.1'
                    }
                });

                if (lookupRes.ok) {
                    const fieldsData = await lookupRes.json();
                    const fields = Array.isArray(fieldsData) ? fieldsData : (fieldsData.data || []);

                    const match = fields.find((f: any) =>
                        f.name?.toLowerCase() === fieldName.toLowerCase() ||
                        f.identifier?.toLowerCase() === fieldName.toLowerCase() ||
                        String(f.id) === String(fieldName)
                    );

                    if (match) {
                        internalFieldId = match.id;
                        fieldInfo = {
                            fieldGroupID: match.fieldGroupID || 1,
                            memberOf: match.memberOf || "clip",
                            identifier: match.identifier || fieldInfo.identifier,
                            name: match.name || fieldName
                        };
                        console.log(`[${reqId}] Match Found: ${fieldInfo.name} (ID: ${internalFieldId}, Identifier: ${fieldInfo.identifier})`);
                    } else {
                        console.warn(`[${reqId}] No field match found in /9/fields for "${fieldName}".`);
                    }
                }
            } catch (e: any) {
                console.warn(`[${reqId}] Field lookup failed at ${lookupUrl}:`, e.message);
            }

            // 2. DO THE SYNC
            const variations = [
                `${apiBase}/9/fields/${internalFieldId}/list?groupID=${fieldInfo.fieldGroupID}&include=values`,
                `${apiBase}/1/fields/${internalFieldId}/list`,
                `${apiBase}/admin/1/fields/${internalFieldId}/list`,
                `${apiBase}/fields/${internalFieldId}/list`
            ];

            let lastErr = null;
            for (const putUrl of variations) {
                console.log(`[${reqId}] Syncing to: ${putUrl}`);
                try {
                    const response = await fetch(putUrl, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `JSESSIONID=${activeSessionId}`,
                            'ngrok-skip-browser-warning': 'true',
                            'User-Agent': 'PostmanRuntime/7.51.1'
                        },
                        body: JSON.stringify({
                            fieldGroupID: fieldInfo.fieldGroupID,
                            memberOf: fieldInfo.memberOf,
                            identifier: fieldInfo.identifier,
                            name: fieldInfo.name,
                            fieldType: "picklist",
                            values: newOptions,
                            isExtensible: true,
                            isKeptSorted: true,
                            savesValues: true,
                            isLocked: false
                        })
                    });

                    const resText = await response.text();
                    console.log(`[${reqId}] CatDV Response (${response.status}): ${resText.slice(0, 500)}`);

                    if (response.ok) return createResponse({ success: true, fieldId: internalFieldId, method: putUrl, catdv: resText });
                    lastErr = { status: response.status, body: resText, url: putUrl };
                    if (response.status === 401) break;
                } catch (e: any) {
                    console.error(`[${reqId}] Sync error at ${putUrl}:`, e.message);
                    lastErr = { error: e.message, url: putUrl };
                }
            }

            return createResponse({ error: 'CatDV Sync Failed', details: lastErr }, lastErr?.status || 500);
        }

        return createResponse({ error: 'Unsupported action' }, 400);

    } catch (error: any) {
        console.error(`[${reqId}] Global Error:`, error.message);
        return createResponse({ error: error.message }, 500);
    }
})
