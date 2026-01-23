import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { Resend } from "npm:resend"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const payload = await req.json()
        const record = payload.record
        const tableName = payload.table
        const userEmail = record.email || record.user_email

        // Fallback project ref if env var is missing or different format
        const projectRef = Deno.env.get('SUPABASE_URL')?.split('//')[1]?.split('.')[0] ?? 'rddqcxfalrlmlvirjlca'

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Enhanced Database Lookup
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id, created_at')
            .eq('email', userEmail)
            .maybeSingle()

        // 2. Setup Logic & Status
        const isExisting = !!profile
        const statusLabel = isExisting ? "Existing User" : "New Prospect"
        const statusColor = isExisting ? "#6f42c1" : "#007bff"

        // Format the join date if they exist
        const joinDate = profile?.created_at
            ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : null

        let targetEmail = "support@rostersync.app"
        let emailFrom = "RosterSync Support <support@rostersync.app>"
        let subjectEmoji = "🚨"
        let colorTheme = "#d9534f"

        if (tableName === 'demo') {
            targetEmail = "demo@rostersync.app"
            emailFrom = "RosterSync Demo <demo@rostersync.app>"
            subjectEmoji = "⚽"
            colorTheme = "#28a745"
        }

        const userContent = record.message || record.use_case || "No details provided."
        const dashboardLink = `https://supabase.com/dashboard/project/${projectRef}/editor/${payload.schema || 'public'}/${tableName}?filter=id%3Deq%3B${record.id}`

        // 3. Send Email
        const { data } = await resend.emails.send({
            from: emailFrom,
            to: [targetEmail],
            subject: `${subjectEmoji} [${statusLabel}] ${record.name}`,
            reply_to: userEmail,
            html: `
        <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; border-radius: 12px; overflow: hidden; color: #333;">
          <div style="background-color: ${colorTheme}; padding: 15px; color: white;">
            <h2 style="margin: 0; font-size: 18px;">${subjectEmoji} ${tableName.toUpperCase()} REQUEST</h2>
          </div>
          
          <div style="padding: 25px;">
            <div style="margin-bottom: 20px;">
              <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 50px; font-size: 11px; font-weight: bold; text-transform: uppercase;">
                ${statusLabel}
              </span>
              ${joinDate ? `<span style="margin-left: 10px; font-size: 12px; color: #666;">Member since ${joinDate}</span>` : ''}
            </div>

            <p style="margin: 5px 0;"><strong>Name:</strong> ${record.name}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail}</p>
            <p style="margin: 5px 0;"><strong>Organization:</strong> ${record.organization || 'N/A'}</p>
            
            <div style="background: #fcfcfc; padding: 15px; border: 1px solid #eee; border-left: 4px solid ${colorTheme}; margin: 25px 0;">
              <strong style="color: ${colorTheme}; font-size: 12px; text-transform: uppercase;">${tableName === 'demo' ? 'Use Case' : 'Message'}</strong><br/>
              <p style="margin-top: 8px; font-size: 15px; line-height: 1.5;">${userContent}</p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${dashboardLink}" 
                 style="display: inline-block; padding: 12px 24px; color: white; background-color: #1c1c1c; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                 Open Database Record
              </a>
            </div>
          </div>

          <div style="background: #f9f9f9; padding: 15px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee;">
            RosterSync Internal Notification • Record ID: ${record.id}
          </div>
        </div>
      `
        })

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
