// =============================================
// Vercel Function — Recherche de vraies recettes
// (cocktails ET/OU mocktails) contenant un ingrédient précis
// Recherche web systématique, jamais d'invention pure IA
// Vérifie que l'ingrédient cherché est réellement présent
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

async function extraireRecette(url, contenu, ingredientCherche) {
  const consigne = `Voici le contenu extrait d'une page web sur un cocktail ou mocktail : """${contenu.slice(0, 3000)}""".

Extrait UNIQUEMENT si tu trouves une vraie recette avec ingrédients identifiables ET que cette recette contient réellement l'ingrédient "${ingredientCherche}" (ou une variante très proche du même nom, ex: "sirop de vanille" = "vanilla syrup"). Si l'ingrédient "${ingredientCherche}" n'apparaît PAS explicitement dans la liste d'ingrédients de cette recette, retourne trouve:false même si une autre recette valide est présente dans le texte — ne substitue jamais un ingrédient proche mais différent (ex: sirop de sucre simple n'est PAS du sirop de vanille).

N'invente RIEN qui ne soit pas dans ce texte — si une quantité n'est pas précisée, mets null.

Retourne ce JSON exactement :
{
  "trouve": true,
  "nom": "nom exact du cocktail",
  "type": "cocktail ou mocktail",
  "ingredient_confirme": true,
  "ingredients": [{"nom": "...", "quantite": 4, "unite": "cl"}],
  "etapes": ["étape 1", "étape 2"],
  "origine": "1-2 phrases sur l'histoire/origine si mentionnée dans le texte, sinon null"
}
Si aucune recette identifiable, ou si "${ingredientCherche}" n'y figure pas : {"trouve": false}`;

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
        { role: 'system', content: 'Tu extrais fidèlement des recettes de cocktails/mocktails depuis du texte web. Jamais d\'invention — quantite:null si absent du texte. Tu vérifies scrupuleusement que l\'ingrédient demandé est vraiment présent, sans jamais le confondre avec un ingrédient similaire mais différent.' },
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

// Filtre de sécurité final côté serveur : vérifie que l'ingrédient cherché
// apparaît vraiment dans la liste d'ingrédients extraite, indépendamment
// de ce que l'IA a affirmé (double vérification, jamais confiance aveugle).
function ingredientReellementPresent(ingredients, ingredientCherche) {
  const cherche = ingredientCherche.toLowerCase().trim();
  return (ingredients || []).some(ing => {
    const nomIng = (ing.nom || '').toLowerCase();
    return nomIng.includes(cherche) || cherche.includes(nomIng);
  });
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

    if (tousResultats.length < 3) {
      for (const type of types) {
        const queryType = type === 'mocktail' ? 'mocktail sans alcool' : 'cocktail';
        const query = `"${ingredient}" ${queryType} recette`;
        const resultatsElargis = await rechercherTavily(query, 4);
        tousResultats.push(...resultatsElargis.map(r => ({ ...r, _type_cherche: type })));
      }
    }

    const urlsVues = new Set();
    tousResultats = tousResultats.filter(r => {
      if (urlsVues.has(r.url)) return false;
      urlsVues.add(r.url);
      return true;
    }).slice(0, 10);

    const extractions = await Promise.allSettled(
      tousResultats.map(r => extraireRecette(r.url, r.content || r.title || '', ingredient))
    );

    const recettes = extractions
      .filter(e => e.status === 'fulfilled' && e.value.trouve)
      .map(e => e.value)
      // Double vérification serveur : rejette tout résultat où l'ingrédient
      // cherché n'apparaît finalement pas dans la liste extraite.
      .filter(r => ingredientReellementPresent(r.ingredients, ingredient));

    return res.status(200).json({ success: true, recettes });

  } catch (e) {
    console.error('ERREUR chercher-par-ingredient:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
