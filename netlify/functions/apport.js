// =============================================
// Netlify Function — Apport gustatif
// via OpenAI GPT-4o Mini
// =============================================
 
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
 
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: '{}' };
 
  try {
    const { caveNoms, manquantsTop } = JSON.parse(event.body);
 
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1000,
        messages: [{
          role: 'system',
          content: 'Tu es un expert bartender. Tu réponds uniquement en JSON valide, sans markdown.'
        }, {
          role: 'user',
          content: `Cave actuelle : ${caveNoms}. Ingrédients manquants qui débloquent le plus de recettes : ${manquantsTop}. Pour chaque ingrédient manquant, explique en 1-2 phrases l'apport gustatif qu'il apporterait à la cave et quels accords il ouvrirait avec les alcools déjà présents. Réponds en JSON : [{"nom": "...", "apport": "..."}]. Uniquement le JSON.`
        }]
      })
    });
 
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '[]';
    const items = JSON.parse(text);
 
    return { statusCode: 200, headers, body: JSON.stringify(items) };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify([]) };
  }
};
 
