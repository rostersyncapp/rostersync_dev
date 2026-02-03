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
        const { action, username, password, appId, authToken, fieldName, options: newOptions } = await req.json()

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

        // --- SYNC FIELD OPTIONS ACTION ---
        if (action === 'sync_field_options') {
            // Variables are already destructured at the top
            if (!appId || !authToken || !fieldName || !Array.isArray(newOptions)) {
                return new Response(
                    JSON.stringify({ error: 'Missing required parameters: appId, authToken, fieldName, or options array.' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            console.log(`Syncing options for field: '${fieldName}'`);
            console.log(`AppID length: ${appId?.length}, AuthToken length: ${authToken?.length}`);
            console.log(`AppID start: ${appId?.substring(0, 5)}..., AuthToken start: ${authToken?.substring(0, 5)}...`);

            const headers = {
                'App-ID': appId,
                'Auth-Token': authToken,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            // 1. Try Direct Access (Strict usage of Field Label as ID per user request)
            let getUrl = `https://app.iconik.io/API/metadata/v1/fields/${fieldName}/`;
            let getRes = await fetch(getUrl, { method: 'GET', headers });
            let fieldData = null;

            if (getRes.ok) {
                console.log(`Direct access successful for '${fieldName}'`);
                fieldData = await getRes.json();
            } else {
                const getErrText = await getRes.text();
                console.log(`Direct access failed. Status: ${getRes.status}. Response: ${getErrText}`);

                // ABORTING Fallback Search to strictly follow user request:
                // "we need to use https://app.iconik.io/API/metadata/v1/fields/{field_name}/"
                // "{field_name} needs to come from the saved FIELD LABEL"

                return new Response(
                    JSON.stringify({
                        error: `Field '${fieldName}' not found.`,
                        details: `Iconik returned ${getRes.status}: ${getErrText}. Please ensure your 'Field Label' in settings matches the exact Field Name (ID) in Iconik.`,
                        debug_info: {
                            attempted_url: getUrl,
                            appId_start: appId?.substring(0, 5),
                            authToken_start: authToken?.substring(0, 5),
                        }
                    }),
                    { status: getRes.status || 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // 3. Update the options
            // Merge existing options with new ones to avoid overwriting unrelated options
            const existingOptions = fieldData.options || [];

            // Create a map of existing options for easy lookup
            const optionMap = new Map(existingOptions.map((opt: any) => [typeof opt === 'string' ? opt : opt.value, opt]));

            // Add or update options
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

            // Sort by Last Name (Heuristic: last word in string)
            updatedOptions.sort((a: any, b: any) => {
                const getLastName = (opt: any) => {
                    const label = typeof opt === 'string' ? opt : opt.label;
                    const parts = label.trim().split(/\s+/);
                    return parts[parts.length - 1] || "";
                };
                const lnA = getLastName(a).toLowerCase();
                const lnB = getLastName(b).toLowerCase();

                if (lnA !== lnB) return lnA.localeCompare(lnB);

                // Fallback to full name if last names are identical
                const fullA = (typeof a === 'string' ? a : a.label).toLowerCase();
                const fullB = (typeof b === 'string' ? b : b.label).toLowerCase();
                return fullA.localeCompare(fullB);
            });

            if (addedCount === 0) {
                return new Response(
                    JSON.stringify({ message: 'No new options to add.', optionsV: updatedOptions.length }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Paylod for PUT
            const updatePayload = {
                // Only sending back fields likely to be accepted for update
                options: updatedOptions,
                label: fieldData.label || fieldData.name || fieldData.id,
                description: fieldData.description || "",
                field_type: fieldData.field_type,
                name: fieldData.name || fieldData.id // Ensure name is present, as it might be required for validation
            };

            const putUrl = `https://app.iconik.io/API/metadata/v1/fields/${fieldData.name || fieldData.id}/`;
            console.log(`Updating field options at: ${putUrl}`);

            const putRes = await fetch(putUrl, {
                method: 'PUT',
                headers,
                body: JSON.stringify(updatePayload)
            });

            if (!putRes.ok) {
                const errText = await putRes.text();
                console.log(`PUT Payload: ${JSON.stringify(updatePayload)}`);
                console.log(`PUT Failed: ${putRes.status} | ${errText}`);

                return new Response(
                    JSON.stringify({
                        error: `Failed to update field '${fieldName}'`,
                        details: errText,
                        debug_info: {
                            put_url: putUrl,
                            payload_keys: Object.keys(updatePayload)
                        }
                    }),
                    { status: putRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const putData = await putRes.json();
            return new Response(
                JSON.stringify({ success: true, message: `Field updated with ${addedCount} new options.`, data: putData }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

        console.log(`Proxying check connection for AppID: ${appId.substring(0, 5)}...`);

        // Try User Endpoint First
        const userUrl = 'https://app.iconik.io/API/users/v1/users/me/';
        const headers: Record<string, string> = {
            'App-ID': appId,
            'Auth-Token': authToken,
            'Accept': 'application/json'
        };

        let response = await fetch(userUrl, { method: 'GET', headers });
        let data = await response.json().catch(() => null);

        // Fallback: Try Metadata Field List (since user endpoint might 404 for some tokens)
        if (!response.ok) {
            console.log('User check failed, trying Metadata check...');
            const metadataUrl = 'https://app.iconik.io/API/metadata/v1/fields/?limit=1';
            const metaRes = await fetch(metadataUrl, { method: 'GET', headers });

            if (metaRes.ok) {
                // Succeeded with metadata check!
                return new Response(
                    JSON.stringify({ success: true, message: "Metadata API connection verified.", source: "metadata" }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // If both fail, return the error from the User check (or metadata check)
            return new Response(
                JSON.stringify({
                    error: 'Iconik Connection Failed',
                    status: response.status,
                    upstream_data: data
                }),
                {
                    status: response.status || 500,
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
