// =============================================
// Vercel Function — Identification produit (alcool ou non)
// GPT direct, puis recherche Tavily de secours si incertain
// Chemin : api/identifier.js
// =============================================

const PROMPT_BASE = `ATTENTION : ce n'est pas forcement un alcool — verifie d'abord s'il s'agit d'un produit alcoolise ou non (ex: Crodino, San Bitter, Sanbitter sont des analcolici italiens a 0 degre, PAS des liqueurs ; ginger ale, tonic, soda tonic sont des sodas ; JNPR, Lyre's, Seedlip, Æcorn sont des spiritueux SANS ALCOOL). Retourne ce JSON exactement : {"identifie":true,"trop_vague":false,"alcoolise":true,"categorie_id":"gin","sous_type_alcool":"london-dry","tourbe":false,"degre":40,"description":"description courte","origine":"origine courte","anecdote":"anecdote courte"}. Le champ alcoolise est un boolean : false si le produit est un soda, un analcolico (0 ou tres faible degre), ou tout spiritueux/mixer sans alcool. Si alcoolise est false, categorie_id doit etre "sodas-mixers" et sous_type_alcool doit etre null et degre doit etre 0. Si alcoolise est true, categorie_id doit etre parmi : liqueurs, gin, vodka, whisky, mezcal-tequila, rhum, eaux-de-vie, bulles, bitters, vermouth, triples-secs, sirops. sous_type_alcool depend de categorie_id, vocabulaire controle uniquement (mets null si aucun ne correspond clairement, jamais un mot invente) : pour gin -> london-dry, old-tom, plymouth, contemporain, aromatise, genievre ; pour vodka -> neutre, aromatisee ; pour rhum -> blanc, ambre, brun, agricole, epice, overproof, cachaca ; pour whisky -> scotch-blended, scotch-single-malt, bourbon, rye, irlandais, japonais ; pour mezcal-tequila -> blanco, reposado, anejo, mezcal ; pour eaux-de-vie -> cognac, armagnac, brandy, calvados, pisco ; pour vermouth -> sec, rouge, bianco, sherry, porto ; pour triples-secs -> orange, bleu, marasquin ; pour liqueurs -> herbes-amers, fruits-creme, cafe-creme ; pour bitters -> null toujours ; pour bulles -> champagne, prosecco ; pour sirops -> null toujours. tourbe est un boolean independant, vrai uniquement si explicitement fume/tourbe (surtout whisky Islay), sinon false. Si vraiment inconnu meme avec le contexte fourni : identifie false.`;

async function appelerGPT(nom, contexteWeb) {
  const contenu = contexteWeb
    ? `Identifie ce produit : "${nom}". Voici des informations reelles trouvees sur le web a son sujet, base-toi UNIQUEMENT dessus, n'invente rien qui ne soit pas dans ce texte : """${contexteWeb}""". ${PROMPT_BASE}`
    : `Identifie ce produit : "${nom}". ${PROMPT_BASE}`;

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
        { role: 'system', content: 'Tu es expert en spiritueux ET en boissons non-alcoolisees (sodas, bitters analcolici, mixers, spiritueux sans alcool). Reponds uniquement en JSON valide. Fidelite a la source avant tout — jamais inventer une info non fournie.' },
        { role: 'user', content: contenu }
      ]
    })
  });
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '{"identifie":false}';
  return JSON.parse(text);
}

async function rechercherTavily(nom) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `"${nom}" spiritueux OU boisson alcool degre`,
        max_results: 3
      })
    });
    const data = await res.json();
    const contenus = (data.results || []).map(r => r.content).filter(Boolean);
    return contenus.join(' ').slice(0, 1500) || null;
  } catch (e) {
    console.error('Erreur Tavily:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({});

  try {
    const { nom } = req.body;
    console.log('Identification demandée pour:', nom);

    let result = await appelerGPT(nom, null);
    let sourceWeb = false;

    // Si l'IA n'est pas sûre, on cherche du contexte réel avant de retenter
    if (!result.identifie || result.trop_vague) {
      const contexte = await rechercherTavily(nom);
      if (contexte) {
        result = await appelerGPT(nom, contexte);
        sourceWeb = true;
      }
    }

    console.log('Resultat final:', JSON.stringify(result), 'via web:', sourceWeb);
    return res.status(200).json({ ...result, source_web: sourceWeb });

  } catch (e) {
    console.error('ERREUR:', e.message);
    return res.status(200).json({ identifie: false, trop_vague: false, error: e.message });
  }
}
