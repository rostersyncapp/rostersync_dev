
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { messages, userId } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            throw new Error("Invalid messages format");
        }

        // Initialize Gemini (using same key as main app)
        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) {
            throw new Error("Missing GEMINI_API_KEY");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Construct System Prompt
        const systemPrompt = `You are the Support Agent for RosterSync, a broadcast roster management tool.
    Your goal is to help users import rosters, troubleshooting errors, and explain features.
    
    KEY PRODUCT KNOWLEDGE:
    - RosterSync takes raw text (from PDFs, emails, websites) and converts it into structured athlete data.
    - We support exports to CSV, Adobe After Effects, CatDV, and Ross Xpression.
    - Users can organize rosters into projects and folders.
    - "AI Scout" is our core engine that identifies teams and players.
    - If a user has an error, ask them to copy/paste the error message.
    - Be concise, helpful, and friendly.
    - If you don't know the answer, suggest they email support@rostersync.io.
    `;

        // Format history for Gemini
        // Note: Gemini API expects { role: 'user' | 'model', parts: [{ text: string }] }
        // User messages -> role: 'user'
        // Assistant messages -> role: 'model'
        const chatHistory = messages.slice(0, -1).map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        const lastMessage = messages[messages.length - 1].content;
        const fullPrompt = `${systemPrompt}\n\nUser Question: ${lastMessage}`;

        const chat = model.startChat({
            history: chatHistory,
        });

        const result = await chat.sendMessage(fullPrompt);
        const responseText = result.response.text();

        // Log interaction (optional)
        if (userId) {
            console.log(`[Support] User ${userId} asked: ${lastMessage.substring(0, 50)}...`);
        }

        return new Response(
            JSON.stringify({ reply: responseText }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error("Chat Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
