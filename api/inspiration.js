// =============================================
// Vercel Function — Analyse inspiration cocktail
// Chemin : api/inspiration.js
// =============================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({});

  try {
    const { nom, ingredients, gout_context, recettes_existantes } = req.body;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert bartending. Tu proposes des recettes précises et équilibrées. Réponds uniquement en JSON valide.'
          },
          {
            role: 'user',
            content: `Propose une recette complète pour ce cocktail.

Nom : "${nom}"
Ingrédients observés : ${ingredients}
${gout_context || ''}

Recettes existantes pour comparaison : ${recettes_existantes}

Retourne ce JSON exactement :
{
  "famille": "famille bartending (Spritz, Sour, Fizz, Negroni...)",
  "base_alcool": "spiritueux principal",
  "verre": "type de verre recommandé",
  "difficulte": "facile ou moyen ou avance",
  "type": "nouvelle ou variante",
  "recette_similaire": "nom de la recette la plus proche ou null",
  "dosages": [
    {"nom": "nom ingrédient", "quantite": 50, "unite": "ml"}
  ],
  "profil": {
    "gout_sucre": 2,
    "gout_amer": 1,
    "gout_acide": 3,
    "gout_fruite": 2,
    "gout_fume": 0,
    "gout_floral": 1,
    "gout_epice": 0,
    "gout_cremeux": 0
  },
  "explication": "courte explication en français sur la famille, l équilibre et les similitudes"
}`
          }
        ]
      })
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    const result = JSON.parse(text);
    return res.status(200).json(result);
  } catch(e) {
    console.error('ERREUR inspiration:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
