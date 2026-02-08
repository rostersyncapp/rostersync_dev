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
    if (!obj) return null;
    if (typeof obj === 'string' && obj.length > 10) return obj;
    if (typeof obj !== 'object') return null;

    // Check direct keys
    const keys = ['jsessionid', 'jSessionId', 'JSESSIONID', 'sessionId', 'id', 'token', 'accessToken', 'data'];
    for (const key of keys) {
        if (obj[key] && typeof obj[key] === 'string' && obj[key].length > 5) return obj[key];
    }

    // Recursively check
    for (const key in obj) {
        if (obj[key] && typeof obj[key] === 'object') {
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
            let fieldInfo: {
                fieldGroupID: number;
                memberOf: string;
                identifier: string;
                name: string;
                label: string;
            } = {
                fieldGroupID: 1,
                memberOf: "clip",
                identifier: fieldName.includes('.') ? fieldName : `custom.${fieldName.toLowerCase().replace(/\s/g, '.')}`,
                name: fieldName,
                label: fieldName
            };

            const discoveryPaths = [`${apiBase}/9/fields`, `${apiBase}/1/fields`/*, `${apiBase}/fields`*/];
            let fields: any[] = [];

            for (const lookupUrl of discoveryPaths) {
                try {
                    const separator = lookupUrl.includes('?') ? '&' : '?';
                    const finalUrl = `${lookupUrl}${separator}jsessionid=${activeSessionId}`;
                    console.log(`[${reqId}] Fetching fields from: ${finalUrl}`);
                    const lookupRes = await fetch(finalUrl, {
                        headers: {
                            'Cookie': `JSESSIONID=${activeSessionId}`,
                            'ngrok-skip-browser-warning': 'true',
                            'User-Agent': 'PostmanRuntime/7.51.1'
                        }
                    });

                    if (lookupRes.ok) {
                        const rawData = await lookupRes.json();
                        console.log(`[${reqId}] Lookup response from ${lookupUrl}:`, JSON.stringify(rawData).slice(0, 500));

                        // Check if the body itself indicates an error despite 200 OK
                        if (rawData && (rawData.status === "AUTH" || rawData.errorMessage === "Authentication Required")) {
                            console.warn(`[${reqId}] Auth failure detected in 200 response body`);
                            continue;
                        }

                        if (Array.isArray(rawData)) {
                            fields = rawData;
                        } else if (rawData && rawData.data && Array.isArray(rawData.data.items)) {
                            fields = rawData.data.items;
                        } else if (rawData && Array.isArray(rawData.data)) {
                            fields = rawData.data;
                        } else if (rawData && rawData.fields && Array.isArray(rawData.fields)) {
                            fields = rawData.fields;
                        }

                        if (fields.length > 0) break;
                    }
                } catch (e: any) {
                    console.warn(`[${reqId}] Discovery failed at ${lookupUrl}:`, e.message);
                }
            }

            if (fields.length > 0) {
                console.log(`[${reqId}] Total fields discovered: ${fields.length}`);
                const match = fields.find((f: any) => {
                    const fName = (f.name || f.Name || "").toLowerCase();
                    const fIden = (f.identifier || f.Field || f.field || f.fField || "").toLowerCase();
                    const fId = String(f.id || f.ID || "").toLowerCase();
                    const target = fieldName.toLowerCase();
                    return fName === target || fIden === target || fId === target;
                });

                if (match) {
                    // Order of preference for ID/Identifier: ID, Field, identifier, id
                    internalFieldId = match.ID || match.Field || match.field || match.identifier || match.id || fieldName;
                    fieldInfo = {
                        fieldGroupID: match.fieldGroupID || match.fieldGroupId || match.groupID || 1,
                        memberOf: match.memberOf || "clip",
                        identifier: match.identifier || match.Field || match.field || fieldInfo.identifier,
                        name: match.name || match.Name || fieldName,
                        label: match.label || match.Label || match.name || match.Name || fieldName
                    };
                    console.log(`[${reqId}] SUCCESS: Found match "${fieldInfo.name}" (Target ID: ${internalFieldId}) (Label: ${fieldInfo.label})`);
                } else {
                    console.warn(`[${reqId}] Field "${fieldName}" not found in discovered list.`);
                    const sample = fields.slice(0, 3).map(f => `${f.Name || f.name} (${f.Field || f.identifier})`);
                    console.log(`[${reqId}] Discovery samples: ${sample.join(' | ')}`);
                }
            } else {
                console.error(`[${reqId}] CRITICAL: Could not retrieve a list of fields from any endpoint.`);
            }

            // 2. DO THE SYNC
            const syncUrls = [
                `${apiBase}/9/fields/${internalFieldId}/list?groupID=${fieldInfo.fieldGroupID}&include=values`,
                `${apiBase}/1/fields/${internalFieldId}/list`,
                `${apiBase}/fields/${internalFieldId}/list`
            ];

            let lastErr = null;
            for (const putUrl of syncUrls) {
                const separator = putUrl.includes('?') ? '&' : '?';
                const finalPutUrl = `${putUrl}${separator}jsessionid=${activeSessionId}`;
                console.log(`[${reqId}] Syncing to: ${finalPutUrl}`);
                try {
                    const response = await fetch(finalPutUrl, {
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
                            label: fieldInfo.label || fieldInfo.name,
                            fieldType: "picklist",
                            values: newOptions,
                            isExtensible: true,
                            isKeptSorted: false,
                            savesValues: true,
                            isLocked: false
                        })
                    });

                    const resText = await response.text();
                    console.log(`[${reqId}] Sync Result (${response.status}): ${resText.slice(0, 500)}`);

                    let resData: any = null;
                    try { resData = JSON.parse(resText); } catch (e) { }

                    if (response.ok && (!resData || (resData.status !== "AUTH" && resData.errorMessage !== "Authentication Required"))) {
                        return createResponse({ success: true, fieldId: internalFieldId, method: finalPutUrl, catdv: resText });
                    }
                    lastErr = { status: response.status, body: resText, url: putUrl };
                    if (response.status === 401) break;
                } catch (e: any) {
                    console.error(`[${reqId}] Sync network error at ${putUrl}:`, e.message);
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
