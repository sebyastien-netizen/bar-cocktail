// =============================================
// Vercel Function — Lire une recette depuis un screenshot
// Chemin : api/lire-recette.js
// =============================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image_base64 } = req.body;
  if (!image_base64) return res.status(400).json({ error: 'Image manquante' });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1000,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'system',
          content: 'Tu es un extracteur de recettes de cocktails depuis des images. Lis le texte visible sur l\'image (y compris legende ou texte superpose) et extrais la recette. REGLES : recopie exactement les noms d\'ingredients tels qu\'ils apparaissent, sans traduire. Convertis toutes les quantites de volume en cl (ex: 45ml = 4.5cl). Si une quantite n\'est pas lisible ou pas un volume, mettre quantite: null et unite: null (vraies valeurs JSON null, jamais le texte "null"). Le champ "methode" est un TABLEAU detapes, jamais une phrase unique — une entree par etape distincte si plusieurs sont visibles/lisibles, sinon une seule entree, sinon methode: []. Ne jamais en inventer une qui ne serait pas lisible sur l\'image. Ne jamais inventer un ingredient absent de l\'image. Reponds UNIQUEMENT en JSON valide. Format : { "nom": "...", "ingredients": [{"nom": "...", "quantite": 4.5, "unite": "cl"}], "garniture": "...", "methode": ["..."], "source": "..." } Si aucune recette lisible : { "nom": null, "ingredients": [] }'
        }, {
          role: 'user',
          content: [
            { type: 'text', text: 'Extrais la recette de cocktail visible sur ce screenshot.' },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + image_base64 } }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errTxt = await response.text();
      return res.status(502).json({ error: `OpenAI a répondu une erreur (${response.status})`, detail: errTxt });
    }

    const data = await response.json();
    const texte = data.choices?.[0]?.message?.content || '{"nom":null,"ingredients":[]}';

    let result;
    try { result = JSON.parse(texte); }
    catch (e) { return res.status(502).json({ error: 'Réponse IA invalide', reponse_brute: texte.slice(0, 300) }); }

    return res.status(200).json(result);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
