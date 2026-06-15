/* ═══════════════════════════════════════════════════
   GEMINI AI HELPER (Using Groq)
══════════════════════════════════════════════════ */

export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

export const FARM_CTX = `You are an expert strawberry farm advisor for Kodaikanal, Tamil Nadu.
Farm: Melissa variety, 10,000 plants, 0.5 acre, open field, drip irrigation, 19-20°C, sandy loam soil, Day 90+.
Available products: MinSol 13:00:45 (KNO3 – potassium nitrate), Boron Minsol 20%, FertiGlobal NIXI (N-liquid Foliflo), FertiGlobal ONDA (K/P Folistim), FertiGlobal COLORE 5kg (colour+sugar Folimac), Simodis/Thiamethoxam (PHI 7 days), Arigato (insecto-fungicide, check label PHI), Azoxystrobin 18.2%+Difenoconazole 11.4% (PHI 3 days), Ridomil Gold Metalaxyl-M+Mancozeb (PHI 7 days).
Always: Reply in Tamil first then English. Give exact product name from stock, dose per 100L, timing, PHI days. Be concise and practical.`;

export const callGemini = async (prompt, imageData = null) => {
  try {
    const messages = [
      { role: "system", content: FARM_CTX },
      { role: "user", content: prompt }
    ];

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        temperature: 0.4,
        max_tokens: 1200
      })
    });

    const data = await res.json();
    if (data.error) return `❌ Groq Error: ${data.error.message}`;
    return data.choices?.[0]?.message?.content || 'பதில் கிடைக்கவில்லை.';
  } catch (e) {
    return `❌ Network error: ${e.message}`;
  }
};