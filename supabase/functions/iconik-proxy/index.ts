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

            console.log(`Syncing options for field: ${fieldName}`);
            const headers = {
                'App-ID': appId,
                'Auth-Token': authToken,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            // 1. Look up field by label/name to get the actual field ID
            const searchUrl = `https://app.iconik.io/API/metadata/v1/fields/?name=${encodeURIComponent(fieldName)}`;
            const searchRes = await fetch(searchUrl, { method: 'GET', headers });

            if (!searchRes.ok) {
                const errText = await searchRes.text();
                return new Response(
                    JSON.stringify({ error: `Failed to search for field '${fieldName}'`, details: errText }),
                    { status: searchRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const fieldsData = await searchRes.json();
            const fields = fieldsData.results || fieldsData;
            const matchedField = Array.isArray(fields)
                ? fields.find((f: any) => f.label === fieldName || f.name === fieldName)
                : null;

            if (!matchedField) {
                const availableFields = Array.isArray(fields) ? fields.map((f: any) => f.label || f.name) : [];
                return new Response(
                    JSON.stringify({ error: `Field '${fieldName}' not found. Available fields: ${JSON.stringify(availableFields)}` }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const fieldId = matchedField.id;
            console.log(`Found field '${fieldName}' with ID: ${fieldId}`);

            // 2. GET field definition using the actual field ID
            const getUrl = `https://app.iconik.io/API/metadata/v1/fields/${fieldId}/`;
            const getRes = await fetch(getUrl, { method: 'GET', headers });

            if (!getRes.ok) {
                const errText = await getRes.text();
                return new Response(
                    JSON.stringify({ error: `Failed to fetch field '${fieldName}' (ID: ${fieldId})`, details: errText }),
                    { status: getRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const fieldData = await getRes.json();

            // 3. Merge options
            // Iconik options can be plain strings or objects {label: "X", value: "Y"}
            // We will normalize to what we find.
            let updatedOptions = [...(fieldData.options || [])];
            const existingValues = new Set(updatedOptions.map((o: any) => typeof o === 'string' ? o : o.value));
            let addedCount = 0;

            newOptions.forEach((opt: string) => {
                if (!existingValues.has(opt)) {
                    // If existing options are objects, add as object. Default to string.
                    if (updatedOptions.length > 0 && typeof updatedOptions[0] === 'object') {
                        updatedOptions.push({ label: opt, value: opt });
                    } else {
                        updatedOptions.push(opt);
                    }
                    existingValues.add(opt);
                    addedCount++;
                }
            });

            if (addedCount === 0) {
                return new Response(
                    JSON.stringify({ message: 'No new options to add.', optionsV: updatedOptions.length }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // 3. PUT updated field definition
            // We send back the entire object with modified options
            fieldData.options = updatedOptions;

            const putRes = await fetch(getUrl, {
                method: 'PUT',
                headers,
                body: JSON.stringify(fieldData)
            });

            if (!putRes.ok) {
                const errText = await putRes.text();
                return new Response(
                    JSON.stringify({ error: `Failed to update field '${fieldName}'`, details: errText }),
                    { status: putRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const putData = await putRes.json();
            return new Response(
                JSON.stringify({ success: true, added: addedCount, total: updatedOptions.length, field: putData }),
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
