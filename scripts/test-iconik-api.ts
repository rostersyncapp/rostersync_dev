
import 'dotenv/config';

// Usage: npx tsx scripts/test-iconik-api.ts <AppID> <AuthToken> <FieldLabel>

const appId = process.argv[2];
const authToken = process.argv[3];
const fieldName = process.argv[4] || 'testroster';

if (!appId || !authToken) {
    console.error('Usage: npx tsx scripts/test-iconik-api.ts <AppID> <AuthToken> <FieldLabel>');
    process.exit(1);
}

const headers = {
    'App-ID': appId,
    'Auth-Token': authToken,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};

async function testIconik() {
    console.log(`Testing Iconik API with AppID: ${appId} and Field: ${fieldName}`);

    // 1. Verifying Token (Try multiple endpoints)
    console.log('\n1. Verifying Token...');

    const userEndpoints = [
        'https://app.iconik.io/API/users/v1/users/me/',
        'https://app.iconik.io/API/users/v1/users/current/',
        'https://app.iconik.io/API/auth/v1/auth/user/',
        // The one currently in proxy (might be wrong)
        'https://app.iconik.io/API/users/current/'
    ];

    let userVerified = false;
    for (const url of userEndpoints) {
        try {
            console.log(`   Trying: ${url}`);
            const res = await fetch(url, { headers });
            if (res.ok) {
                const data = await res.json();
                console.log(`   ✅ Success! (${url})`);
                console.log(`      User: ${data.email || data.id || 'Unknown'}`);
                userVerified = true;
                break;
            } else {
                console.log(`      ❌ Failed: ${res.status}`);
            }
        } catch (e) {
            console.log(`      ❌ Error: ${e.message}`);
        }
    }

    if (!userVerified) {
        console.warn('⚠️ Could not verify user with standard endpoints. Token might still be valid for Metadata.');
    }

    // 2. Test "Search Field By Name"
    console.log(`\n2. Searching for Field: "${fieldName}"...`);
    // Try user's search method
    const searchUrl = `https://app.iconik.io/API/metadata/v1/fields/?name=${encodeURIComponent(fieldName)}`;
    // Also try partial match or just listing
    // const searchUrl = `https://app.iconik.io/API/metadata/v1/fields/?limit=10&search=${encodeURIComponent(fieldName)}`; 

    try {
        const searchRes = await fetch(searchUrl, { headers });
        if (!searchRes.ok) {
            console.error('❌ Search Failed:', searchRes.status, await searchRes.text());
        } else {
            const data = await searchRes.json();
            console.log('✅ Search Success! Response:', JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error('❌ Network Error on Search:', err);
    }

    // 3. Test "Direct Field Access" (Fallback)
    console.log(`\n3. Testing Direct Access (GET /fields/${fieldName}/)...`);
    const directUrl = `https://app.iconik.io/API/metadata/v1/fields/${fieldName}/`;
    try {
        const directRes = await fetch(directUrl, { headers });
        if (!directRes.ok) {
            console.error('⚠️ Direct Access Failed:', directRes.status, await directRes.text());
        } else {
            console.log('✅ Direct Access Success!');
        }
    } catch (err) {
        console.error('❌ Network Error on Direct Access:', err);
    }
}

testIconik();
