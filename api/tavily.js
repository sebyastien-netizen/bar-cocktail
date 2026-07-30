export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL manquante' });

  try {
    // ---- Extraction Tavily : 'basic' d'abord (moins de crédits), 'advanced' si insuffisant ----
    async function extraire(depth) {
      const r = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          urls: [url],
          extract_depth: depth
        })
      });
      if (!r.ok) {
        const errTxt = await r.text();
        throw new Error(`Tavily a répondu une erreur (${r.status}) : ${errTxt}`);
      }
      const data = await r.json();
      return data?.results?.[0]?.raw_content || '';
    }

    let contenu = await extraire('basic');
    let depthUtilisee = 'basic';

    // Seuil empirique : en dessous de 500 caractères, la page est probablement
    // chargée en JS (contenu vide/squelette) — on retente en advanced.
    if (contenu.length < 500) {
      contenu = await extraire('advanced');
      depthUtilisee = 'advanced';
    }

    if (!contenu) {
      return res.status(400).json({
        error: 'Impossible de lire le contenu de cette page, même en extraction avancée. Le site est peut-être protégé contre le scraping, ou l\'URL est incorrecte.',
        etape: 'extraction_tavily'
      });
    }

    // ---- Structuration OpenAI ----
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: 'Tu es un extracteur de recettes de cocktails. Extrait toutes les recettes presentes dans le texte. REGLES : 1) Recopie les noms dingrédients exactement tels quils apparaissent dans le texte. 2) Convertis les quantites en cl (ex: 50ml = 5cl). 3) Si une quantite nest pas mentionnee, mettre quantite: null. 4) Ne jamais inventer un ingredient absent du texte. 5) Ignore navigation, footer, publicite. Reponds UNIQUEMENT en JSON valide sans markdown. Format : { "recettes": [ { "nom": "...", "ingredients": [{"nom": "...", "quantite": 5, "unite": "cl"}], "methode": "...", "verre": "...", "garniture": "..." } ] }'
          },
          {
            role: 'user',
            content: contenu.substring(0, 8000)
          }
        ]
      })
    });

    if (!openaiRes.ok) {
      const errTxt = await openaiRes.text();
      return res.status(502).json({
        error: `OpenAI a répondu une erreur (${openaiRes.status}). Réessaie dans quelques instants.`,
        detail: errTxt,
        etape: 'structuration_openai'
      });
    }

    const openaiData = await openaiRes.json();
    const texte = openaiData.choices?.[0]?.message?.content || '{"recettes":[]}';

    let result;
    try {
      result = JSON.parse(texte);
    } catch (e) {
      return res.status(502).json({
        error: 'La réponse de l\'IA n\'était pas un JSON valide — le contenu de la page était peut-être trop confus à structurer.',
        etape: 'parsing_json',
        reponse_brute: texte.slice(0, 500)
      });
    }

    // Contexte utile pour comprendre ce qui a été utilisé, sans bloquer l'usage normal côté app
    result._meta = { extract_depth_utilisee: depthUtilisee, longueur_contenu: contenu.length };

    return res.status(200).json(result);

  } catch (e) {
    return res.status(500).json({ error: e.message, etape: 'inconnue' });
  }
}
