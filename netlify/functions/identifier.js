// =============================================
// Netlify Function — Identification alcool
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
        response_format: { type: 'json_object' },
        messages: [{
          role: 'system',
          content: 'Tu es expert en spiritueux. Tu identifies les alcools et retournes uniquement du JSON valide.'
        }, {
          role: 'user',
          content: `Identifie cet alcool : "${nom}".
 
Retourne ce JSON (et rien d'autre) :
{
  "identifie": true,
  "trop_vague": false,
  "categorie_id": "gin",
  "degre": 40,
  "description": "Description courte en 1-2 phrases.",
  "origine": "Origine en 1-2 phrases.",
  "anecdote": "Anecdote intéressante en 1-2 phrases."
}
 
Règles :
- categorie_id doit être une parmi : liqueurs, gin, vodka, whisky, mezcal-tequila, rhum, eaux-de-vie, bulles, bitters, vermouth, triples-secs, sirops
- Si le nom est trop vague (juste "gin", "vodka"...) : identifie=false, trop_vague=true
- Si le produit est inconnu : identifie=false, trop_vague=false, autres champs null`
        }]
      })
    });
 
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '{}';
 
    // Nettoyer les backticks markdown si présents
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(clean);
 
    return { statusCode: 200, headers, body: JSON.stringify(result) };
 
  } catch (e) {
    console.error('Erreur identifier:', e.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ identifie: false, trop_vague: false, error: e.message })
    };
  }
};
 
