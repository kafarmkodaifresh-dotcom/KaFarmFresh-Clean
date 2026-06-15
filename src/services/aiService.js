import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true
});

export const generateWeeklyPlan = async (productList, last14Days, weatherForecast) => {
  const prompt = `
You are a strawberry farm advisor in Kodaikanal, TN.
Farm: 10,000 plants, Melissa variety, day 90+, open field, drip irrigation.

Available products (name, dose/100L, PHI, stock kg):
${productList.map(p => `- ${p.productName}: ${p.dosePer100L || 'N/A'}, PHI: ${p.PHI || 'N/A'}, Stock: ${p.stockQuantity || 0}kg`).join('\n')}

Last 14 days of applied products (to avoid repeats):
${last14Days.map(d => `- ${d.productName} on ${d.date}`).join('\n')}

Weather forecast for the next 7 days (date, temp, humidity, wind, rain chance):
${weatherForecast.map(w => `- ${w.date}: ${w.temp}°C, ${w.humidity}% humidity, ${w.wind} m/s wind, ${w.rainChance}% rain`).join('\n')}

Task: Suggest the best fertiliser/pesticide for each of the next 7 days.
Rules:
- Avoid spraying if rain chance > 60%.
- Avoid spraying if wind > 15 km/h.
- Respect PHI days (do not apply a product if harvest is within PHI days).
- Do not repeat the same product within 7 days.
- Prioritise products with higher stock.
- If a product is low in stock (less than 2kg), suggest an alternative and warn.
- For each day, output: date, product name, dose/100L, reason, PHI, and a note if stock is low.

Return as JSON array.
`;

  try {
    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      max_tokens: 1200
    });

    const content = response.choices[0]?.message?.content || '[]';
    // Parse JSON from the response (handle markdown code blocks if present)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (error) {
    console.error('AI service error:', error);
    return [];
  }
};
