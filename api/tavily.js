const SUPABASE_URL = 'https://wqsprjlocuhandhvpytx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g4pDtkemUi-6VUG6qgVJWw_PAy5YibN';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL manquante' });

  try {
    // ---- Extraction Tavily en 'advanced' systématique ----
    // (testé avec 'basic' d'abord pour économiser des crédits, mais ça a fait perdre
    // les quantités sur au moins un site — la fiabilité prime, le volume d'usage est faible)
    async function extraire(depth) {
      const r = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          urls: [url],
          extract_depth: depth,
          include_images: true
        })
      });
      if (!r.ok) {
        const errTxt = await r.text();
        throw new Error(`Tavily a répondu une erreur (${r.status}) : ${errTxt}`);
      }
      const data = await r.json();
      return {
        contenu: data?.results?.[0]?.raw_content || '',
        images: data?.results?.[0]?.images || []
      };
    }

    let { contenu, images } = await extraire('advanced');
    let depthUtilisee = 'advanced';

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
            content: 'Tu es un extracteur de recettes de cocktails. Extrait toutes les recettes presentes dans le texte. REGLES : 1) Traduis TOUT en francais (noms d\'ingredients, methode, verre, garniture) meme si le texte source est dans une autre langue — mais traduis fidelement, sans changer le sens ni inventer. 2) Convertis TOUTE mesure de volume en cl et mets unite a "cl" : ml (50ml = 5cl), oz (1oz = 3cl), cuillere a cafe / c. a cafe / tsp (1 = 0,5cl), cuillere a soupe / c. a soupe / tbsp (1 = 1,5cl). 3) Si la quantite nest PAS un volume (ex: 1/2 citron, 3 feuilles de menthe, 1 zeste), recopie le nombre dans quantite et lunite reelle (traduite en francais) dans unite (ex: "citron", "feuilles", "zeste") — ne force jamais "cl" sur quelque chose qui ne se mesure pas en volume. 4) Si aucune quantite, garniture, methode ou verre nest mentionne ou visible, mets la valeur JSON null (jamais le texte "null" entre guillemets, jamais une chaine vide). 5) Ne jamais inventer un ingredient absent du texte. 6) Ignore navigation, footer, publicite. Reponds UNIQUEMENT en JSON valide sans markdown. Format : { "recettes": [ { "nom": "...", "ingredients": [{"nom": "...", "quantite": 5, "unite": "cl"}], "methode": "...", "verre": "...", "garniture": "..." } ] }'
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

    // ---- Renormalisation FR via le lexique ingredients_traductions ----
    // (utile quand le site source sert du contenu en anglais par défaut aux robots,
    // indépendamment de notre consigne "ne pas traduire" — voir table dédiée)
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
      // Le lexique est un plus, pas un bloquant — on continue même s'il échoue
    }

    // Contexte utile pour comprendre ce qui a été utilisé, sans bloquer l'usage normal côté app
    result._meta = { extract_depth_utilisee: depthUtilisee, longueur_contenu: contenu.length, images: images.slice(0, 6) };

    return res.status(200).json(result);

  } catch (e) {
    return res.status(500).json({ error: e.message, etape: 'inconnue' });
  }
}
