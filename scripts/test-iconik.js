// Node.js version of the Iconik Connection Tester
// Run with: node scripts/test-iconik.js <email> <password> <app_id> [auth_token]

console.log("-----------------------------------------");
console.log("   Standalone Iconik Connection Tester   ");
console.log("-----------------------------------------");

async function testIconikLogin(email, password, appId) {
    const url = 'https://app.iconik.io/API/auth/v1/auth/simple/login/';
    console.log(`\nAttempting Login to: ${url}`);

    const payload = {
        email: email,
        password: password,
        app_name: 'RosterSync'
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'App-ID': appId
            },
            body: JSON.stringify(payload)
        });

        console.log(`Response Status: ${res.status} ${res.statusText}`);

        // Log ALL headers to check for Auth-Token
        console.log("Response Headers:");
        res.headers.forEach((value, key) => {
            console.log(`  ${key}: ${value}`);
        });

        const text = await res.text();
        console.log("Response Body (Raw):");
        console.log(text);

        try {
            return JSON.parse(text);
        } catch (e) {
            return { error: "Could not parse JSON", raw: text };
        }
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

async function verifyToken(appId, authToken) {
    const url = 'https://app.iconik.io/API/users/v1/users/current/';
    console.log(`\nAttempting Token Verification to: ${url}`);

    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'App-ID': appId,
                'Auth-Token': authToken
            }
        });

        console.log(`Response Status: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log("Response Body:");
        console.log(text.substring(0, 500) + "...");
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

// Check for arguments
const args = process.argv.slice(2);
if (args.length < 3) {
    console.log("\nUsage: node scripts/test-iconik.js <email> <password> <app_id> [auth_token]");
    console.log("Example:");
    console.log("  node scripts/test-iconik.js my@email.com mypass123 12345-app-id");
    process.exit(1);
}

const [email, password, appId, authToken] = args;

(async () => {
    await testIconikLogin(email, password, appId);

    if (authToken) {
        console.log("\nSince you provided an Auth Token, testing that too...");
        await verifyToken(appId, authToken);
    }
})();
