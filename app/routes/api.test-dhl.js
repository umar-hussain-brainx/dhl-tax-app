import { json } from "@remix-run/node";
import { testDhlIntegration } from "../utilities/dhl-helper";

export async function action({ request }) {
    if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
        const result = await testDhlIntegration();
        return json({ success: true, data: result });
    } catch (error) {
        return json({ 
            success: false, 
            error: error.message,
            details: error.response?.data 
        }, { status: 500 });
    }
} 