// =============================================
// Netlify Function — Identification alcool
// via OpenAI GPT-4o Mini
// =============================================
 
exports.handler = async (event) => {
  // CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
 
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
 
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
 
  try {
    const { nom } = JSON.parse(event.body);
    if (!nom) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nom manquant' }) };
 
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 600,
        messages: [{
          role: 'system',
          content: 'Tu es expert en spiritueux et alcools du monde entier. Tu réponds uniquement en JSON valide, sans markdown ni backticks.'
        }, {
          role: 'user',
          content: `Identifie ce produit alcoolisé : "${nom}".
Réponds UNIQUEMENT en JSON :
{
  "identifie": true/false,
  "trop_vague": true/false,
  "categorie_id": "une parmi : liqueurs, gin, vodka, whisky, mezcal-tequila, rhum, eaux-de-vie, bulles, bitters, vermouth, triples-secs, sirops",
  "degre": nombre ou null,
  "description": "1-2 phrases courtes" ou null,
  "origine": "1-2 phrases courtes" ou null,
  "anecdote": "1-2 phrases courtes originales" ou null
}
Si nom trop vague (juste "gin", "whisky"...) : trop_vague true, identifie false.
Si inconnu : identifie false, autres champs null.`
        }]
      })
    });
 
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    const result = JSON.parse(text);
 
    return { statusCode: 200, headers, body: JSON.stringify(result) };
 
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message, identifie: false })
    };
  }
};
 
