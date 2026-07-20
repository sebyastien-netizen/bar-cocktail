// =============================================
// Vercel Function — Analyse complète d'un alcool
// vs cave de Seb
// Chemin : api/analyser.js
// =============================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({});

  try {
    const { nom, cave } = req.body;

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
            content: `Tu es un bartender professionnel expert en spiritueux et en cocktails classiques et modernes. 
Tu donnes des avis précis, directs et techniques. Tu connais les prix du marché français. 
Réponds uniquement en JSON valide, sans texte générique ni formules creuses.`
          },
          {
            role: 'user',
            content: `Analyse cet alcool : "${nom}".

Cave actuelle du bartender (ce qu'il possède déjà) : ${cave}.

Ta mission :
1. Identifier précisément l'alcool
2. Détecter si un alcool similaire est déjà en cave (même famille ET profil proche)
3. Lister les cocktails classiques ou modernes réalisables avec cet alcool ET les ingrédients déjà en cave — sois précis et exhaustif, minimum 3 cocktails si possible
4. Évaluer si une meilleure version existe (millésime supérieur, expression premium) avec prix réel français
5. Identifier une alternative moins chère donnant le même résultat en cocktail avec prix réel français
6. Donner un avis bartender technique et personnel sur la complémentarité avec cette cave précise
7. Rendre un verdict tranché et justifié

Retourne ce JSON exactement, sans champ supplémentaire :
{
  "identifie": true,
  "nom_complet": "nom commercial exact et complet",
  "categorie": "catégorie précise (ex: London Dry Gin, Rhum Agricole, Single Malt Islay...)",
  "degre": 40,
  "profil_gustatif": "3-5 notes aromatiques précises séparées par des virgules",
  "doublon_cave": "nom exact de l'alcool similaire déjà en cave, ou null",
  "doublon_note": "en 1 phrase : en quoi ils se ressemblent ET en quoi ils diffèrent, ou null",
  "cocktails_possibles": [
    {"nom": "Negroni", "ingredients_manquants": [], "difficulte": "facile"},
    {"nom": "Last Word", "ingredients_manquants": ["Marasquin"], "difficulte": "moyen"}
  ],
  "meilleure_version": "nom exact d'une expression supérieure si applicable, ou null",
  "meilleure_version_prix": 45,
  "variante_moins_chere": "nom exact d'un équivalent moins cher en cocktail, ou null",
  "variante_moins_chere_prix": 18,
  "complementarite": "en 2-3 phrases techniques : ce que cet alcool apporte CONCRÈTEMENT à cette cave précise, quels profils gustatifs il ouvre ou complète",
  "verdict": "ACHETER | PASSER | DOUBLON | MIEUX_AILLEURS",
  "verdict_raison": "1 phrase directe et argumentée expliquant le verdict"
}
Si alcool non identifié : {"identifie": false}`
          }
        ]
      })
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '{"identifie":false}';
    const result = JSON.parse(text);
    return res.status(200).json(result);

  } catch (e) {
    console.error('ERREUR analyser:', e.message);
    return res.status(200).json({ identifie: false, error: e.message });
  }
}
