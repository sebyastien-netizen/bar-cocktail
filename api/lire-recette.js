// =============================================
// Vercel Function — Lire une recette depuis un screenshot
// Chemin : api/lire-recette.js
// Aligné sur tavily.js : conversion déterministe, base_alcool, verre, complements
// =============================================

const SUPABASE_URL = 'https://wqsprjlocuhandhvpytx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g4pDtkemUi-6VUG6qgVJWw_PAy5YibN';

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
        max_tokens: 2800,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'system',
          content: 'Tu es un extracteur de recettes de cocktails depuis des images. Lis le texte visible sur l\'image (y compris legende ou texte superpose) et extrais la ou les recette(s). REGLES : 1) Traduis en francais les noms d\'ingredients, la methode, le verre et la garniture, meme si le texte source visible sur l\'image est dans une autre langue — mais traduis fidelement, sans changer le sens ni inventer. Le champ "nom" (titre du cocktail) reste TOUJOURS dans sa langue et son orthographe d\'origine, ne le traduis JAMAIS. Corrige les fautes de frappe evidentes sur des noms de marques connues et reconnaissables (ex: image floue affichant "Cointrau" -> ecris "Cointreau"), mais n\'invente jamais une marque qui ne serait pas clairement lisible ou reconnaissable. 2) NE CONVERTIS JAMAIS TOI-MEME les unites — recopie le nombre et l\'unite EXACTEMENT tels qu\'ils apparaissent sur l\'image (ex: "2 oz" reste quantite:2, unite:"oz"). La conversion en cl est faite par un autre systeme, pas par toi. 3) Identifie le spiritueux principal dans "base_alcool" (nom court et courant en francais, ex: "Gin", "Rhum blanc"), null si mocktail ou pas clair. 4) Le champ "methode" est un TABLEAU d\'etapes, jamais une phrase unique — une entree par etape distincte si plusieurs sont visibles, sinon une seule entree, sinon methode: []. 5) Si un verre est visible ou mentionne, indique-le dans "verre", sinon null. 6) Si des conseils, variantes ou informations utiles autres que la recette de base sont visibles (pro tips, historique court), resume-les en 2-3 phrases maximum en francais dans "complements" (paraphrase, jamais copie mot pour mot), sinon complements: null. 7) Ne jamais inventer un ingredient, une quantite ou une etape absente de l\'image. Si une quantite n\'est pas lisible, mettre quantite: null et unite: null (vraies valeurs JSON null). 8) Si plusieurs recettes distinctes sont visibles sur l\'image, extrais-les toutes. Reponds UNIQUEMENT en JSON valide, sans markdown. Format : { "recettes": [ { "nom": "...", "base_alcool": "...", "ingredients": [{"nom": "...", "quantite": 2, "unite": "oz"}], "methode": ["..."], "verre": "...", "garniture": "...", "complements": "..." } ] } Si aucune recette lisible : { "recettes": [] }'
        }, {
          role: 'user',
          content: [
            { type: 'text', text: 'Extrais la ou les recette(s) de cocktail visible(s) sur ce screenshot.' },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + image_base64 } }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errTxt = await response.text();
      return res.status(502).json({ error: `OpenAI a répondu une erreur (${response.status})`, detail: errTxt, etape: 'lecture_image' });
    }

    const data = await response.json();
    const texte = data.choices?.[0]?.message?.content || '{"recettes":[]}';

    let result;
    try {
      result = JSON.parse(texte);
    } catch (e) {
      return res.status(502).json({ error: 'La réponse de l\'IA n\'était pas un JSON valide.', etape: 'parsing_json', reponse_brute: texte.slice(0, 500) });
    }

    // ---- Conversion déterministe des unités de volume en cl (identique à tavily.js) ----
    const CONVERSIONS_CL = {
      'oz': 3, 'ounce': 3, 'ounces': 3, 'fl oz': 3,
      'ml': 0.1, 'millilitre': 0.1, 'millilitres': 0.1,
      'cl': 1, 'centilitre': 1, 'centilitres': 1,
      'l': 100, 'litre': 100, 'litres': 100,
      'tsp': 0.5, 'teaspoon': 0.5, 'cuillere a cafe': 0.5, 'cuillère à café': 0.5, 'c. a cafe': 0.5, 'c. à café': 0.5,
      'tbsp': 1.5, 'tablespoon': 1.5, 'cuillere a soupe': 1.5, 'cuillère à soupe': 1.5, 'c. a soupe': 1.5, 'c. à soupe': 1.5,
      'dash': 0.1, 'trait': 0.1, 'traits': 0.1
    };

    function convertirEnCl(quantite, unite) {
      if (quantite == null || !unite) return { quantite, unite };
      const cle = unite.toString().toLowerCase().trim();
      const facteur = CONVERSIONS_CL[cle];
      if (facteur == null) return { quantite, unite };
      return { quantite: Math.round(quantite * facteur * 100) / 100, unite: 'cl' };
    }

    for (const recette of (result.recettes || [])) {
      for (const ing of (recette.ingredients || [])) {
        const conv = convertirEnCl(ing.quantite, ing.unite);
        ing.quantite = conv.quantite;
        ing.unite = conv.unite;
      }
    }

    // ---- Renormalisation FR via le lexique ingredients_traductions (identique à tavily.js) ----
    try {
      const lexiqueRes = await fetch(
        `${SUPABASE_URL}/rest/v1/ingredients_traductions?select=nom_en,nom_fr`,
        { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      if (lexiqueRes.ok) {
        const lexique = await lexiqueRes.json();
        const dico = new Map(lexique.map(l => [l.nom_en.toLowerCase().trim(), l.nom_fr]));
        for (const recette of (result.recettes || [])) {
          for (const ing of (recette.ingredients || [])) {
            const cle = (ing.nom || '').toLowerCase().trim();
            if (dico.has(cle)) ing.nom = dico.get(cle);
          }
        }
      }
    } catch (e) {
      // Non bloquant
    }

    return res.status(200).json(result);

  } catch (e) {
    return res.status(500).json({ error: e.message, etape: 'inconnue' });
  }
}
