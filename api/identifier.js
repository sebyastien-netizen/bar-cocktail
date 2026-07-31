// =============================================
// Vercel Function — Identification alcool
// via OpenAI GPT-4o Mini
// Chemin : api/identifier.js
// =============================================
 
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
 
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({});
 
  try {
    const { nom } = req.body;
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
            content: 'Identifie cet alcool : "' + nom + '". Retourne ce JSON exactement : {"identifie":true,"trop_vague":false,"categorie_id":"gin","sous_type_alcool":"london-dry","tourbe":false,"degre":40,"description":"description courte","origine":"origine courte","anecdote":"anecdote courte"}. categorie_id doit etre parmi : liqueurs, gin, vodka, whisky, mezcal-tequila, rhum, eaux-de-vie, bulles, bitters, vermouth, triples-secs, sirops. sous_type_alcool depend de categorie_id, vocabulaire controle uniquement (mets null si aucun ne correspond clairement, jamais un mot invente) : pour gin -> london-dry, old-tom, plymouth, contemporain, aromatise, genievre ; pour vodka -> neutre, aromatisee ; pour rhum -> blanc, ambre, brun, agricole, epice, overproof, cachaca ; pour whisky -> scotch-blended, scotch-single-malt, bourbon, rye, irlandais, japonais ; pour mezcal-tequila -> blanco, reposado, anejo, mezcal ; pour eaux-de-vie -> cognac, armagnac, brandy, calvados, pisco ; pour vermouth -> sec, rouge, bianco, sherry, porto ; pour triples-secs -> orange, bleu, marasquin ; pour liqueurs -> herbes-amers, fruits-creme, cafe-creme ; pour bitters -> null toujours ; pour bulles -> champagne, prosecco ; pour sirops -> null toujours. tourbe est un boolean independant, vrai uniquement si explicitement fume/tourbe (surtout whisky Islay), sinon false. Si trop vague : identifie false, trop_vague true. Si inconnu : identifie false.'
          }
        ]
      })
    });
 
    console.log('Status OpenAI:', response.status);
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '{"identifie":false}';
    const result = JSON.parse(text);
    console.log('Resultat final:', JSON.stringify(result));
 
    return res.status(200).json(result);
 
  } catch (e) {
    console.error('ERREUR:', e.message);
    return res.status(200).json({ identifie: false, trop_vague: false, error: e.message });
  }
}
