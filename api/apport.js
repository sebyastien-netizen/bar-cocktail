// =============================================
// Vercel Function — Apport gustatif
// via OpenAI GPT-4o Mini
// Chemin : api/apport.js
// =============================================
 
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
 
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({});
 
  try {
    const { caveNoms, manquantsTop } = req.body;
 
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
 
    return res.status(200).json(items);
 
  } catch (e) {
    console.error('ERREUR:', e.message);
    return res.status(500).json([]);
  }
}
 
