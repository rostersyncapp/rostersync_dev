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

            // 1. Try Direct Access first (Most common case where Name = ID)
            let getUrl = `https://app.iconik.io/API/metadata/v1/fields/${fieldName}/`;
            console.log(`Attempting Direct Access: ${getUrl}`);
            let getRes = await fetch(getUrl, { method: 'GET', headers });
            let fieldData = null;
            let getErrText = ''; // Declare here to be accessible later

            if (getRes.ok) {
                console.log(`Direct access successful for '${fieldName}'`);
                fieldData = await getRes.json();
            } else {
                getErrText = await getRes.text();
                console.log(`Direct access failed. Status: ${getRes.status}. Response: ${getErrText}`);

                console.log(`Trying search by name/label...`);
                // 2. If Direct Access fails (e.g. 404 because user provided Label, not Name), try Search
                const searchUrl = `https://app.iconik.io/API/metadata/v1/fields/?name=${encodeURIComponent(fieldName)}`;
                const searchRes = await fetch(searchUrl, { method: 'GET', headers });

                if (!searchRes.ok) {
                    const errText = await searchRes.text();
                    console.log(`Search failed. Status: ${searchRes.status}. Response: ${errText}`);
                    return new Response(
                        JSON.stringify({
                            error: `Failed to find field '${fieldName}' via ID or Search`,
                            details: `Direct: ${getRes.status} ${getErrText} | Search: ${searchRes.status} ${errText}`,
                            debug_info: {
                                appId_start: appId?.substring(0, 5),
                                authToken_start: authToken?.substring(0, 5),
                                appId_len: appId?.length,
                                authToken_len: authToken?.length
                            }
                        }),
                        { status: searchRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                const fieldsData = await searchRes.json();
                const fields = fieldsData.results || fieldsData.objects || fieldsData; // Handle various list formats

                // Try exact match on 'label' or 'name'
                const matchedField = Array.isArray(fields)
                    ? fields.find((f: any) => f.label === fieldName || f.name === fieldName)
                    : null;

                if (!matchedField) {
                    // If no exact match, return 404
                    return new Response(
                        JSON.stringify({ error: `Field '${fieldName}' not found in search results.` }),
                        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                // Use the found ID
                getUrl = `https://app.iconik.io/API/metadata/v1/fields/${matchedField.name}/`; // .name is usually the ID
                fieldData = matchedField;
            }

            // 3. Update the options
            // Merge existing options with new ones to avoid overwriting unrelated options
            const existingOptions = fieldData.options || [];

            // Create a map of existing options for easy lookup
            const optionMap = new Map(existingOptions.map((opt: any) => [typeof opt === 'string' ? opt : opt.value, opt]));

            // Add or update options
            let addedCount = 0;
            newOptions.forEach((optStr: string) => {
                if (!optionMap.has(optStr)) {
                    // If existing options are objects, add as object. Default to string.
                    if (existingOptions.length > 0 && typeof existingOptions[0] === 'object') {
                        optionMap.set(optStr, { label: optStr, value: optStr });
                    } else {
                        optionMap.set(optStr, optStr);
                    }
                    addedCount++;
                }
            });

            const updatedOptions = Array.from(optionMap.values());

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
                label: fieldData.label,
                description: fieldData.description,
                field_type: fieldData.field_type
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
