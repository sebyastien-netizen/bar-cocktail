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
    const body = JSON.parse(event.body);
    const nom = body.nom;
    console.log('Identification demandée pour:', nom);
 
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
        messages: [
          {
            role: 'system',
            content: 'Tu es expert en spiritueux. Reponds uniquement en JSON valide.'
          },
          {
            role: 'user',
            content: 'Identifie cet alcool : "' + nom + '". Retourne ce JSON exactement : {"identifie":true,"trop_vague":false,"categorie_id":"gin","degre":40,"description":"description courte","origine":"origine courte","anecdote":"anecdote courte"}. categorie_id doit etre parmi : liqueurs, gin, vodka, whisky, mezcal-tequila, rhum, eaux-de-vie, bulles, bitters, vermouth, triples-secs, sirops. Si trop vague : identifie false, trop_vague true. Si inconnu : identifie false.'
          }
        ]
      })
    });
 
    console.log('Status OpenAI:', response.status);
    const data = await response.json();
    console.log('Reponse OpenAI:', JSON.stringify(data).slice(0, 300));
 
    const text = data.choices?.[0]?.message?.content || '{"identifie":false}';
    console.log('Texte extrait:', text);
 
    const result = JSON.parse(text);
    console.log('Resultat final:', JSON.stringify(result));
 
    return { statusCode: 200, headers, body: JSON.stringify(result) };
 
  } catch (e) {
    console.error('ERREUR:', e.message, e.stack);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ identifie: false, trop_vague: false, error: e.message })
    };
  }
};
 
