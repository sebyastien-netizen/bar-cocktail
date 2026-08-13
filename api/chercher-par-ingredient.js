// =============================================
// Vercel Function — Recherche de vraies recettes
// (cocktails ET/OU mocktails) contenant un ingrédient précis
// Recherche web systématique, jamais d'invention pure IA
// Chemin : api/chercher-par-ingredient.js
// =============================================

async function rechercherTavily(query, maxResults = 6) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: maxResults
    })
  });
  const data = await res.json();
  return data.results || [];
}

async function extraireRecette(url, contenu) {
  const consigne = `Voici le contenu extrait d'une page web sur un cocktail ou mocktail : """${contenu.slice(0, 3000)}""".

Extrait UNIQUEMENT si tu trouves une vraie recette avec ingrédients identifiables. N'invente RIEN qui ne soit pas dans ce texte — si une quantité n'est pas précisée, mets null.

Retourne ce JSON exactement :
{
  "trouve": true,
  "nom": "nom exact du cocktail",
  "type": "cocktail ou mocktail",
  "ingredients": [{"nom": "...", "quantite": 4, "unite": "cl"}],
  "etapes": ["étape 1", "étape 2"],
  "origine": "1-2 phrases sur l'histoire/origine si mentionnée dans le texte, sinon null"
}
Si aucune recette identifiable dans ce texte : {"trouve": false}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Tu extrais fidèlement des recettes de cocktails/mocktails depuis du texte web. Jamais d\'invention — quantite:null si absent du texte.' },
        { role: 'user', content: consigne }
      ]
    })
  });
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '{"trouve":false}';
  try {
    const result = JSON.parse(text);
    if (result.trouve) result._source_url = url;
    return result;
  } catch (e) {
    return { trouve: false };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({});

  try {
    const { ingredient, types } = req.body;
    if (!ingredient || !types?.length) {
      return res.status(400).json({ error: 'Ingrédient et type(s) requis' });
    }

    let tousResultats = [];

    for (const type of types) {
      const queryType = type === 'mocktail' ? 'mocktail sans alcool recipe' : 'cocktail recipe';
      const query = `"${ingredient}" ${queryType}`;
      const resultats = await rechercherTavily(query, 5);
      tousResultats.push(...resultats.map(r => ({ ...r, _type_cherche: type })));
    }

    // Si peu de résultats trouvés, recherche élargie (sans guillemets stricts)
    if (tousResultats.length < 3) {
      for (const type of types) {
        const queryType = type === 'mocktail' ? 'mocktail sans alcool' : 'cocktail';
        const query = `${ingredient} ${queryType} recette`;
        const resultatsElargis = await rechercherTavily(query, 4);
        tousResultats.push(...resultatsElargis.map(r => ({ ...r, _type_cherche: type })));
      }
    }

    // Déduplique par URL
    const urlsVues = new Set();
    tousResultats = tousResultats.filter(r => {
      if (urlsVues.has(r.url)) return false;
      urlsVues.add(r.url);
      return true;
    }).slice(0, 10);

    // Extraction structurée de chaque page (en parallèle)
    const extractions = await Promise.allSettled(
      tousResultats.map(r => extraireRecette(r.url, r.content || r.title || ''))
    );

    const recettes = extractions
      .filter(e => e.status === 'fulfilled' && e.value.trouve)
      .map(e => e.value);

    return res.status(200).json({ success: true, recettes });

  } catch (e) {
    console.error('ERREUR chercher-par-ingredient:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
