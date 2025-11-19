import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service not configured");
    }

    console.log("Processing medical chat request with", messages.length, "messages");

    const systemPrompt = `You are MediAssist, a helpful medical information assistant. Your role is to:

IMPORTANT GUIDELINES:
1. Always start responses with a clear disclaimer when providing medical information
2. Provide general health information based on symptoms described
3. Suggest when users should seek immediate medical attention
4. Never provide specific diagnoses or prescribe medications
5. Encourage users to consult healthcare professionals for proper diagnosis and treatment
6. Be empathetic and professional

EMERGENCY SITUATIONS - If user mentions any of these, strongly recommend immediate medical attention:
- Chest pain or pressure
- Difficulty breathing or shortness of breath
- Severe bleeding
- Loss of consciousness
- Severe head injury
- Sudden vision loss
- Stroke symptoms (face drooping, arm weakness, speech difficulty)
- Severe allergic reactions
- Poisoning or overdose

RESPONSE FORMAT:
- For symptom inquiries: Acknowledge symptoms, provide general information, suggest self-care if appropriate, recommend when to see a doctor
- For treatment questions: Provide general wellness advice, emphasize importance of professional medical consultation
- For emergency situations: Immediately and prominently recommend calling emergency services

Always maintain a calm, professional, and caring tone.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service credits exhausted. Please contact support." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
    
  } catch (e) {
    console.error("Medical chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
