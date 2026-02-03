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

        const { action, username, password, appId, authToken, fieldName, options: newOptions } = body;

        // --- LOGIN ACTION ---
        if (action === 'login') {
            if (!username || !password || !appId) {
                return createResponse({ error: 'Missing username, password, or appId' }, 400);
            }

            console.log(`[${reqId}] Proxying login for: ${username}, appId: ${appId}`);

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

            const responseText = await response.text();
            let data: any = {};
            try { data = JSON.parse(responseText); } catch (e) { }

            // Inject Header Token into Body if present
            const headerToken = response.headers.get('Auth-Token');
            if (headerToken) {
                data.auth_token = headerToken;
            }

            // Handle System Domains response (Enterprise Auth)
            if (data.auth_system_domains && Array.isArray(data.auth_system_domains) && data.auth_system_domains.length > 0) {
                const firstDomain = data.auth_system_domains[0];
                if (firstDomain.token) {
                    data.token = firstDomain.token;
                    data.app_id = loginHeaders['App-ID'];
                }
            }

            if (!response.ok) {
                console.error(`[${reqId}] Login failed upstream: ${response.status}`);
                return createResponse({
                    error: 'Iconik Login Failed',
                    status: response.status,
                    upstream_data: data
                }, response.status);
            }

            return createResponse(data);
        }

        // --- SYNC FIELD OPTIONS ACTION ---
        if (action === 'sync_field_options') {
            if (!appId || !authToken || !fieldName || !Array.isArray(newOptions)) {
                return createResponse({ error: 'Missing required parameters: appId, authToken, fieldName, or options array.' }, 400);
            }

            console.log(`[${reqId}] Syncing options for field: '${fieldName}'`);

            const headers = {
                'App-ID': appId,
                'Auth-Token': authToken,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            // 1. Get current field definition
            const getUrl = `https://app.iconik.io/API/metadata/v1/fields/${fieldName}/`;
            const getRes = await fetch(getUrl, { method: 'GET', headers });

            if (!getRes.ok) {
                const getErrText = await getRes.text();
                console.error(`[${reqId}] Field lookup failed: ${getRes.status}`);
                return createResponse({
                    error: `Field '${fieldName}' not found.`,
                    details: `Iconik returned ${getRes.status}: ${getErrText}`,
                    debug_info: { attempted_url: getUrl }
                }, getRes.status);
            }

            const fieldData = await getRes.json();

            // 2. Merge and sort options
            const existingOptions = fieldData.options || [];
            const optionMap = new Map(existingOptions.map((opt: any) => [typeof opt === 'string' ? opt : opt.value, opt]));

            let addedCount = 0;
            const isObjectField = existingOptions.length > 0
                ? typeof existingOptions[0] === 'object'
                : (newOptions.length > 0 && typeof newOptions[0] === 'object');

            newOptions.forEach((newOpt: any) => {
                const val = typeof newOpt === 'object' ? newOpt.value : newOpt;
                const label = typeof newOpt === 'object' ? newOpt.label : newOpt;

                if (!optionMap.has(val)) {
                    if (isObjectField) {
                        optionMap.set(val, { label: label, value: val });
                    } else {
                        optionMap.set(val, val);
                    }
                    addedCount++;
                }
            });

            const updatedOptions = Array.from(optionMap.values());

            // Sort by Last Name
            updatedOptions.sort((a: any, b: any) => {
                const getLastName = (opt: any) => {
                    const label = typeof opt === 'string' ? opt : opt.label;
                    const parts = label.trim().split(/\s+/);
                    return parts[parts.length - 1] || "";
                };
                const lnA = getLastName(a).toLowerCase();
                const lnB = getLastName(b).toLowerCase();
                if (lnA !== lnB) return lnA.localeCompare(lnB);
                return (typeof a === 'string' ? a : a.label).toLowerCase().localeCompare((typeof b === 'string' ? b : b.label).toLowerCase());
            });

            if (addedCount === 0) {
                return createResponse({ message: 'No new options to add.', optionsV: updatedOptions.length });
            }

            // 3. Update field
            const updatePayload = {
                options: updatedOptions,
                label: fieldData.label || fieldData.name || fieldData.id,
                description: fieldData.description || "",
                field_type: fieldData.field_type,
                name: fieldData.name || fieldData.id
            };

            const putUrl = `https://app.iconik.io/API/metadata/v1/fields/${fieldData.name || fieldData.id}/`;
            console.log(`[${reqId}] Updating field at: ${putUrl}`);

            const putRes = await fetch(putUrl, {
                method: 'PUT',
                headers,
                body: JSON.stringify(updatePayload)
            });

            if (!putRes.ok) {
                const errText = await putRes.text();
                console.error(`[${reqId}] Update failed: ${putRes.status}`);
                return createResponse({ error: `Failed to update field '${fieldName}'`, details: errText }, putRes.status);
            }

            const putData = await putRes.json();
            return createResponse({ success: true, message: `Field updated with ${addedCount} new options.`, data: putData });
        }

        // --- CHECK CONNECTION ACTION (DEFAULT) ---
        if (!appId || !authToken) {
            return createResponse({ error: 'Missing appId or authToken' }, 400);
        }

        console.log(`[${reqId}] Checking connection for appId: ${appId.substring(0, 5)}...`);
        const userUrl = 'https://app.iconik.io/API/users/v1/users/me/';
        const headers = { 'App-ID': appId, 'Auth-Token': authToken, 'Accept': 'application/json' };

        const response = await fetch(userUrl, { method: 'GET', headers });
        const responseText = await response.text();

        if (response.ok) {
            return createResponse(JSON.parse(responseText));
        } else {
            // Try metadata check as fallback
            const metadataUrl = 'https://app.iconik.io/API/metadata/v1/fields/?limit=1';
            const metaRes = await fetch(metadataUrl, { method: 'GET', headers });
            const metaText = await metaRes.text();

            if (metaRes.ok) {
                return createResponse({ success: true, message: "Metadata API connection verified.", source: "metadata" });
            }

            return createResponse({ error: 'Iconik Connection Failed', status: response.status, upstream_data: responseText }, response.status);
        }

    } catch (error: any) {
        console.error(`[${reqId}] Global Error:`, error.message);
        return createResponse({ error: error.message }, 500);
    }
})
