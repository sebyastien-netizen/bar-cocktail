// =============================================
// BAR APP — Logique principale avec Supabase
// =============================================
 
const SUPABASE_URL  = 'https://wqsprjlocuhandhvpytx.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_g4pDtkemUi-6VUG6qgVJWw_PAy5YibN';
 
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
 
let cave        = null;
let analyseCourante = null;
let recettes    = [];
let currentUser = null;
let filtreRecherche = '';
let filtreCategorieActive = null;
let filtrePrioriteIngredients = [];
let filtrePrioriteMode = 'OU';
let ongletActif = 'cave';
 
// Section recettes
let sectionRecette  = 'cocktail';
let filtreBase      = '';
let rechercheRecette = '';
let ingredientsAlias = {};
let catNonDetenusOuvertes = new Set();
let glossaireIngredients = [];
let modeSelectionSoiree = false;
let recettesSelectionneesSoiree = new Set();
let selectionPourSoireeEnAttente = null;
let filtreGout      = '';
let filtreDiff      = '';
let filtreDisponible = false;
let filtreDisponibleVoyage = false;
let filtreSansLiaison = false;
let recetteOuverte  = null;
 
// =============================================
// INIT & AUTH
// =============================================
 
async function init() {
  const { data: { session } } = await db.auth.getSession();
  if (session) { currentUser = session.user; afficherApp(); }
  else { afficherLogin(); }
 
  db.auth.onAuthStateChange((_event, session) => {
    if (session) { currentUser = session.user; afficherApp(); }
    else { currentUser = null; afficherLogin(); }
  });
}
 
function afficherLogin() {
  document.getElementById('screen-login').classList.remove('hidden');
  document.getElementById('screen-app').classList.add('hidden');
}
 
async function afficherApp() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
appliquerFondAmbiance();
chargerCave();
  chargerRecettes();
  await chargerStockReserve();
  await chargerVoyageActif();
  chargerEquipements();
  chargerConcoctions();
  chargerDashboard();
 chargerEcoleData();

  const ongletRestaure = sessionStorage.getItem('ongletActif') || 'dashboard';
  const btnRestaure = document.querySelector(`nav button[data-tab="${ongletRestaure}"]`);
  if (btnRestaure && ongletRestaure !== 'dashboard') {
    btnRestaure.click();
  } else {
    document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
    document.getElementById('section-dashboard')?.classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.querySelector('nav button[data-tab="dashboard"]')?.classList.add('active');
  }
}
 
// --- Login ---
document.getElementById('btn-login').addEventListener('click', async () => {
  const email    = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value;
  const errorDiv = document.getElementById('login-error');
  errorDiv.classList.add('hidden');
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    errorDiv.textContent = 'Email ou mot de passe incorrect.';
    errorDiv.classList.remove('hidden');
  }
});
 
document.getElementById('btn-signup').addEventListener('click', async () => {
  const email    = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value;
  const errorDiv = document.getElementById('login-error');
  errorDiv.classList.add('hidden');
  if (!email || password.length < 6) {
    errorDiv.textContent = 'Email valide et mot de passe (6 caractères min) requis.';
    errorDiv.classList.remove('hidden');
    return;
  }
  const { error } = await db.auth.signUp({ email, password });
  if (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
  } else {
    errorDiv.style.background = 'rgba(76,175,125,0.1)';
    errorDiv.style.borderColor = 'rgba(76,175,125,0.3)';
    errorDiv.style.color = '#4caf7d';
    errorDiv.textContent = 'Compte créé ! Vérifiez votre email pour confirmer.';
    errorDiv.classList.remove('hidden');
  }
});
 
document.getElementById('input-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-login').click();
});
 
document.getElementById('btn-logout').addEventListener('click', async () => {
  await db.auth.signOut();
});
 
// =============================================
// NAVIGATION ONGLETS
// =============================================
 
document.querySelectorAll('nav button[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
    document.getElementById('section-' + tab)?.classList.remove('hidden');
    ongletActif = tab;
    sessionStorage.setItem('ongletActif', tab);
    if (tab === 'sessions') chargerSessions();
   if (tab === 'inspirations') chargerInspirations();
  });
});
 
// =============================================
// MA CAVE
// =============================================
 
async function chargerCave() {
  const [{ data: cats }, { data: items }, { data: aAcheter }] = await Promise.all([
    db.from('categories').select('*').order('ordre'),
    db.from('items').select('*, detenu'),
    db.from('a_acheter').select('*')
  ]);
 
  cave = {
    categories: (cats || []).map(cat => ({
      ...cat,
      items: (items || []).filter(i => i.category_id === cat.id)
    })),
    a_acheter: aAcheter || []
  };
 
  renderCave();
}
 
function renderCave() {
const container = document.getElementById('cave-container');
// Sauvegarder la valeur de recherche avant de vider
const searchVal = document.getElementById('search-input')?.value || filtreRecherche;
container.innerHTML = '';

// Search bar créée en premier — avant tout autre rendu
const searchBar = document.createElement('div');
searchBar.className = 'search-bar';
searchBar.innerHTML = `
  <input type="text" id="search-input" placeholder="Rechercher un alcool ou ingrédient…" oninput="onSearch(this.value)" value="${searchVal}">
  <button class="btn btn-outline" onclick="ouvrirModalAjout()">+ Ajouter</button>
`;
container.appendChild(searchBar);

const barreVoyage = document.createElement('div');
barreVoyage.style.cssText = 'margin:10px 0';
barreVoyage.innerHTML = voyageActif
  ? `<button class="btn btn-outline" style="width:100%;padding:10px;border-color:var(--accent);color:var(--accent)" onclick="ouvrirTableauBordVoyage()">🧳 Mode Voyage actif — voir le tableau de bord</button>`
  : `<button class="btn btn-outline" style="width:100%;padding:10px" onclick="${modeSelectionVoyage ? 'lancerModeVoyageDepuisSelection()' : 'toggleModeSelectionVoyage()'}">${modeSelectionVoyage ? `🧳 Activer avec ${bouteillesSelectionneesVoyage.size} bouteille(s)` : '🧳 Activer le Mode Voyage'}</button>`;
container.appendChild(barreVoyage);

renderConservations();
 
  const navCats = document.createElement('div');
  navCats.className = 'cave-nav-cats';
  navCats.innerHTML = `
    <button class="cave-nav-btn ${!filtreCategorieActive ? 'active' : ''}" onclick="filtrerCategorie(null)">
      🍸 <span>Tout</span>
    </button>
    ${cave.categories
      .filter(cat => !cat.id.startsWith('a-acheter'))
      .map(cat => `
        <button class="cave-nav-btn ${filtreCategorieActive === cat.id ? 'active' : ''}"
          onclick="filtrerCategorie('${cat.id}')">
          ${cat.icon} <span>${cat.label}</span>
        </button>
      `).join('')}
  `;
  container.appendChild(navCats);
 
  const prixTotal = cave.categories.reduce((sum, cat) =>
    sum + cat.items.filter(i => i.detenu !== false && i.prix_estime)
                   .reduce((s, i) => s + parseFloat(i.prix_estime), 0), 0);
 
  const prixBanner = document.createElement('div');
  prixBanner.className = 'cave-prix-total';
  prixBanner.innerHTML = `
    <span class="cave-prix-label">Valeur estimée de la cave</span>
    <span class="cave-prix-val">${prixTotal.toFixed(0)} €</span>
  `;
  document.getElementById('cave-container').appendChild(prixBanner);
 
cave.categories.forEach(cat => {
    if (cat.id.startsWith('a-acheter')) return;
    if (filtreCategorieActive && cat.id !== filtreCategorieActive) return;

    const items = filtrerItems(cat.items);
    if (filtreRecherche && items.length === 0) return;

    const detenus = items.filter(i => i.detenu !== false);
    const nonDetenus = items.filter(i => i.detenu === false);
    const ouvert = filtreRecherche ? true : catNonDetenusOuvertes.has(cat.id);

    const div = document.createElement('div');
    div.className = 'categorie open';
    div.id = 'cat-' + cat.id;

    div.innerHTML = `
      <div class="categorie-header" onclick="toggleCategorie('${cat.id}')">
        <span class="categorie-icon">${cat.icon}</span>
        <span class="categorie-label">${cat.label}</span>
        <span class="categorie-count">${items.length} / ${cat.items.length}</span>
        <span class="categorie-chevron">▼</span>
      </div>
      <div class="categorie-items">
        ${detenus.map(item => renderItem(item, cat.id)).join('')}
        ${nonDetenus.length > 0 ? `
        <div class="non-detenus-toggle" onclick="event.stopPropagation(); toggleNonDetenus('${cat.id}')"
          style="padding:8px 14px;font-size:0.8rem;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;gap:6px">
          <span>${ouvert ? '▾' : '▸'}</span> ${nonDetenus.length} non détenu${nonDetenus.length > 1 ? 's' : ''}
        </div>
        <div class="non-detenus-liste" style="display:${ouvert ? 'block' : 'none'}">
          ${nonDetenus.map(item => renderItem(item, cat.id)).join('')}
        </div>` : ''}
      </div>
    `;
    container.appendChild(div);
  });
}

function toggleNonDetenus(catId) {
  if (catNonDetenusOuvertes.has(catId)) catNonDetenusOuvertes.delete(catId);
  else catNonDetenusOuvertes.add(catId);
  renderCave();
}
 async function supprimerItemCave(itemId, catId) {
  const cat = cave.categories.find(c => c.id === catId);
  const item = cat?.items.find(i => i.id === itemId);
  if (!item) return;
  if (!confirm(`Supprimer "${item.nom}" de Ma Cave ? Les recettes liées repasseront en "Non lié".`)) return;

  await db.from('items').delete().eq('id', itemId).eq('user_id', currentUser.id);

  // Nettoyage des références qui pointaient vers cet item
  await db.from('recette_ingredients').update({ item_cave_id: null }).eq('user_id', currentUser.id).eq('item_cave_id', itemId);
  await db.from('ingredients_alias').delete().eq('user_id', currentUser.id).eq('item_cave_id', itemId);
  await db.from('ingredients_glossaire').update({ item_cave_id: null }).eq('user_id', currentUser.id).eq('item_cave_id', itemId);

  // Mise à jour locale
  cat.items = cat.items.filter(i => i.id !== itemId);
  recettes.forEach(r => {
    r.ingredients?.forEach(ing => {
      if (ing.item_cave_id === itemId) ing.item_cave_id = null;
    });
  });
  Object.keys(ingredientsAlias).forEach(k => {
    if (ingredientsAlias[k] === itemId) delete ingredientsAlias[k];
  });
  glossaireIngredients.forEach(g => {
    if (g.item_cave_id === itemId) g.item_cave_id = null;
  });

  renderCave();
}
function renderItem(item, catId) {
  const detenu = item.detenu !== false;
  const statutLabel = !detenu ? 'Non détenu'
    : item.statut === 'en_cours' ? 'En cours'
    : item.cl_restants !== null ? (item.cl_restants === item.cl_total ? 'Plein' : `${item.cl_restants} cl`)
    : 'En stock';
  const statutClass = !detenu ? 'statut-non-detenu'
    : item.statut === 'en_cours' ? 'statut-en-cours'
    : item.cl_restants === null ? 'statut-inconnu'
    : item.cl_restants === item.cl_total ? 'statut-plein'
    : 'statut-entame';
 
  const dotClass = !detenu ? 'non-detenu'
    : item.ouvert ? 'ouvert' : '';
 
const selectionneVoyage = bouteillesSelectionneesVoyage.has(item.id);

return `
    <div class="item-cave ${!detenu ? 'item-non-detenu' : ''}" onclick="${modeSelectionVoyage ? `toggleSelectionBouteilleVoyage('${item.id}', event)` : `ouvrirModalItem('${item.id}', '${catId}')`}" style="${modeSelectionVoyage && selectionneVoyage ? 'outline:2px solid var(--accent);outline-offset:-2px' : ''}">
      ${modeSelectionVoyage ? `<div style="width:20px;height:20px;border-radius:5px;background:${selectionneVoyage ? 'var(--accent)' : 'transparent'};border:1px solid ${selectionneVoyage ? 'var(--accent)' : 'var(--border)'};display:flex;align-items:center;justify-content:center;color:#000;font-size:0.75rem;flex-shrink:0">${selectionneVoyage ? '✓' : ''}</div>` : ''}
      <div class="item-photo-vignette" onclick="event.stopPropagation(); ${modeSelectionVoyage ? '' : `ouvrirPhotoItem('${item.id}', '${catId}')`}" style="width:34px;height:34px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--bg-card);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer">
        ${item.photo_url ? `<img src="${item.photo_url}" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-size:0.85rem;opacity:0.3">🍾</span>`}
      </div>
      <div class="item-ouverture-dot ${dotClass}"></div>
      <div class="item-info">
        <div class="item-nom">${item.nom}</div>
        ${item.detail ? `<div class="item-detail">${item.detail}</div>` : ''}
      </div>
      <span class="item-statut ${statutClass}">${statutLabel}</span>
${detenu && item.prix_estime ? `<span class="item-prix">~${item.prix_estime}€</span>` : ''}
      <div class="item-actions">
        <button class="btn-icon" title="Infos" onclick="event.stopPropagation(); ouvrirModalInfo('${item.id}', '${catId}')">ℹ</button>
        ${detenu ? `<button class="btn-icon" title="Contenance" onclick="event.stopPropagation(); ouvrirModalContenance('${item.id}', '${catId}')">📊</button>` : ''}
        <button class="btn-icon btn-toggle-detenu" title="${detenu ? 'Marquer non détenu' : 'Marquer détenu'}"
          onclick="event.stopPropagation(); toggleDetenu('${item.id}', '${catId}')">
          ${detenu ? '✓' : '+'}
        </button>
      </div>
    </div>
  `;
}
 function ouvrirPhotoItem(itemId, catId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const blob = await new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 600;
        let w = img.width, h = img.height;
        if (w > max) { h = Math.round(h * max / w); w = max; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(b => { resolve(b); URL.revokeObjectURL(url); }, 'image/jpeg', 0.85);
      };
      img.src = url;
    });

    const path = `${currentUser.id}/${itemId}-${Date.now()}.jpg`;
    const { error: uploadError } = await db.storage.from('photos-items').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (uploadError) { alert('Erreur upload : ' + uploadError.message); return; }

    const { data: urlData } = db.storage.from('photos-items').getPublicUrl(path);
    await db.from('items').update({ photo_url: urlData.publicUrl }).eq('id', itemId).eq('user_id', currentUser.id);

    const item = trouverItem(itemId, catId);
    if (item) item.photo_url = urlData.publicUrl;
    renderCave();
  };
  input.click();
}
function renderConservations() {
  const ouverts = [];
  cave.categories.forEach(cat => {
    cat.items.forEach(item => {
      if (item.ouvert && item.conservation) {
        const dateOuverture = item.date_ouverture ? new Date(item.date_ouverture) : new Date();
        const joursEcoules  = Math.floor((Date.now() - dateOuverture) / 86400000);
        const joursMax      = item.conservation.duree_mois * 30;
        const joursRestants = Math.round(joursMax - joursEcoules);
        const niveau        = joursRestants > 90 ? 'vert' : joursRestants > 14 ? 'orange' : 'rouge';
        const delai         = joursRestants > 60
          ? `${Math.round(joursRestants / 30)} mois restants`
          : `${joursRestants} jours restants`;
        ouverts.push({ nom: item.nom, niveau, delai, note: item.conservation.conditions });
      }
    });
  });
 
  if (ouverts.length === 0) return;
 
  const panel = document.createElement('div');
  panel.className = 'conservations-panel';
  panel.innerHTML = `
    <button class="conservations-toggle" onclick="toggleConservations(this)">
      ⚠️ Conservations à surveiller
      <span class="badge">${ouverts.length}</span>
      <span class="chevron">▼</span>
    </button>
    <div class="conservations-body">
      ${ouverts.map(o => `
        <div class="conservation-item">
          <div class="conservation-dot dot-${o.niveau}"></div>
          <div>
            <div class="conservation-nom">${o.nom}</div>
            <div class="conservation-delai">${o.delai}</div>
            <div class="conservation-note">${o.note}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  document.getElementById('cave-container').appendChild(panel);
}
 
function toggleCategorie(id) { document.getElementById('cat-' + id)?.classList.toggle('open'); }
 
function filtrerCategorie(id) {
  filtreCategorieActive = id;
  renderCave();
  document.getElementById('cave-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function toggleConservations(btn) {
  btn.classList.toggle('open');
  btn.nextElementSibling.classList.toggle('visible');
}
function onSearch(val) {
  filtreRecherche = val.toLowerCase();
  if (document.getElementById('modal-ajout').classList.contains('visible')) return;
  renderCave();
  // Remettre le focus sur la search bar après le re-render
  const input = document.getElementById('search-input');
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}
function filtrerItems(items) {
  if (!filtreRecherche) return items;
  return items.filter(i =>
    i.nom.toLowerCase().includes(filtreRecherche) ||
    (i.detail && i.detail.toLowerCase().includes(filtreRecherche))
  );
}
 
// =============================================
// DISPONIBILITÉ RECETTES
// =============================================
 
function getItemsCave() {
  if (!cave) return new Set();
  const ids = new Set();
  cave.categories.forEach(cat => cat.items.forEach(item => {
    if (item.detenu !== false) ids.add(item.id);
  }));
  return ids;
}
 // Retourne les noms (en minuscules) de tous les items détenus, cave active (normale ou voyage)
function getNomsCaveActive() {
  if (voyageActif) {
    return new Set((voyageBouteillesActives || []).map(b => (b.nom || '').toLowerCase()).filter(Boolean));
  }
  if (!cave) return new Set();
  const noms = new Set();
  cave.categories.forEach(cat => cat.items.forEach(item => {
    if (item.detenu !== false) noms.add((item.nom || '').toLowerCase());
  }));
  return noms;
}
let fondAmbianceActuel = null;

async function appliquerFondAmbiance() {
  const isMobile = window.innerWidth < 768;
  const appareil = isMobile ? 'mobile' : 'desktop';

  const { data: fonds } = await db.from('fonds_ambiance')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('appareil', appareil)
    .eq('actif', true);

  if (!fonds || !fonds.length) return;

  const choisi = fonds[Math.floor(Math.random() * fonds.length)];
  fondAmbianceActuel = choisi.url;

  let fondEl = document.getElementById('fond-ambiance-dashboard');
  if (!fondEl) {
    fondEl = document.createElement('div');
    fondEl.id = 'fond-ambiance-dashboard';
fondEl.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background-size: cover; background-position: center;
      z-index: -1; opacity: 0.16;
      mask-image: linear-gradient(to bottom, black 0%, black 30%, rgba(0,0,0,0.15) 100%);
      -webkit-mask-image: linear-gradient(to bottom, black 0%, black 30%, rgba(0,0,0,0.15) 100%);
    `;
    document.body.prepend(fondEl);
  }
  fondEl.style.backgroundImage = `url('${choisi.url}')`;
}
// Vérifie si un nom d'ingrédient texte correspond à un item réellement détenu
function ingredientEnCaveActive(nomIngredient, nomsCave) {
  const key = (nomIngredient || '').toLowerCase().trim();
  if (!key) return false;
  // Mots vides à ignorer dans la comparaison (ne portent pas l'identité de l'ingrédient)
  const motsVides = new Set(['frais', 'fraiche', 'fraîche', 'jaune', 'vert', 'de', 'du', 'la', 'le', 'les', 'd\'', 'l\'']);
  const motsClesIng = key.split(/[\s']+/).filter(m => m.length > 2 && !motsVides.has(m));
  if (motsClesIng.length === 0) return [...nomsCave].some(n => n.includes(key) || key.includes(n));

  return [...nomsCave].some(nomCave => {
    // Match direct (comportement existant conservé)
    if (nomCave.includes(key) || key.includes(nomCave)) return true;
    // Match par mots-clés significatifs communs (au moins 1 mot clé partagé, hors mots vides)
    const motsCave = nomCave.split(/[\s']+/).filter(m => m.length > 2 && !motsVides.has(m));
    return motsClesIng.some(m => motsCave.includes(m));
  });
}
// Trouve l'item_cave_id réel correspondant à un nom d'ingrédient texte (ou null si aucun match fiable)
function trouverItemCaveIdParNom(nomIngredient) {
  const key = (nomIngredient || '').toLowerCase().trim();
  if (!key) return null;
  const motsVides = new Set(['frais', 'fraiche', 'fraîche', 'jaune', 'vert', 'de', 'du', 'la', 'le', 'les']);
  const motsClesIng = key.split(/[\s']+/).filter(m => m.length > 2 && !motsVides.has(m));

  // Cave active : voyage si actif, sinon cave normale — cohérent avec ingredientEnCaveActive
  const pool = voyageActif
    ? (voyageBouteillesActives || []).map(b => ({ id: b.item_cave_id, nom: b.nom || '' }))
    : (cave?.categories?.flatMap(c => c.items) || []).map(i => ({ id: i.id, nom: i.nom || '' }));

  const matchDirect = pool.find(i => {
    const nomCave = i.nom.toLowerCase();
    return nomCave.includes(key) || key.includes(nomCave);
  });
  if (matchDirect) return matchDirect.id;

  const matchMot = pool.find(i => {
    const motsCave = i.nom.toLowerCase().split(/[\s']+/).filter(m => m.length > 2 && !motsVides.has(m));
    return motsClesIng.some(m => motsCave.includes(m));
  });
  return matchMot ? matchMot.id : null;
}
async function enregistrerRecetteDepuisIA(idx) {
  if (!analyseCourante?.cocktails_possibles?.[idx]) { alert('Donnée introuvable, relance l\'analyse.'); return; }
  const c = analyseCourante.cocktails_possibles[idx];

  const slug = c.nom.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const id = `ia-${slug}-${Date.now()}`;

  const diffMap = { facile: 'facile', moyen: 'moyen', difficile: 'avance', avance: 'avance', avancé: 'avance' };
  const difficulte = diffMap[(c.difficulte || '').toLowerCase()] || 'moyen';

  const { error: errRecette } = await db.from('recettes').insert({
    id, user_id: currentUser.id, type: 'cocktail', nom: c.nom, difficulte,
    description_courte: `Suggestion générée lors de l'analyse de "${analyseCourante.nom_complet}".`
  });
  if (errRecette) { alert('Erreur création recette : ' + errRecette.message); return; }

  const ingredientsPayload = (c.ingredients || []).map((ing, i) => ({
    recette_id: id, user_id: currentUser.id, nom: ing.nom,
    item_cave_id: trouverItemCaveIdParNom(ing.nom),
    quantite: parseFloat(ing.quantite) || null, unite: ing.unite || null,
    optionnel: false, ordre: i + 1
  }));
  if (ingredientsPayload.length) {
    const { error: errIng } = await db.from('recette_ingredients').insert(ingredientsPayload);
    if (errIng) { alert('Erreur ingrédients : ' + errIng.message); return; }
  }

  const etapesPayload = (c.etapes || []).map((desc, i) => ({
    recette_id: id, user_id: currentUser.id, ordre: i + 1, titre: `Étape ${i + 1}`, description: desc
  }));
  if (etapesPayload.length) {
    const { error: errEtapes } = await db.from('recette_etapes').insert(etapesPayload);
    if (errEtapes) { alert('Erreur étapes : ' + errEtapes.message); return; }
  }

  alert(`✅ "${c.nom}" enregistrée dans tes recettes.`);
  await chargerRecettes();
}
async function ouvrirHistoriqueAnalyses() {
  const { data: historique } = await db.from('analyses_bouteilles')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const modal = document.createElement('div');
  modal.id = 'modal-historique-analyses';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="max-width:440px;width:100%;background:var(--bg-card);border-radius:16px;padding:20px;max-height:85vh;overflow-y:auto">
      <div style="font-size:1rem;font-weight:700;margin-bottom:14px">🕐 Historique des analyses</div>
      ${!historique?.length ? '<div class="empty-state"><div class="empty-state-titre">Aucune analyse enregistrée</div></div>' : ''}
      ${(historique || []).map(h => `
        <div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"
          onclick="revoirAnalyseHistorique('${h.id}')">
          <div>
            <div style="font-weight:600;font-size:0.88rem">${h.resultat?.nom_complet || h.nom_recherche}</div>
            <div style="font-size:0.72rem;color:var(--text-muted)">${new Date(h.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <button class="btn-outline" style="font-size:0.7rem;padding:4px 8px;color:var(--text-danger);border-color:var(--border-danger)" onclick="event.stopPropagation(); supprimerAnalyseHistorique('${h.id}')">🗑️</button>
        </div>
      `).join('')}
      <button class="btn-outline" style="width:100%;margin-top:8px" onclick="document.getElementById('modal-historique-analyses').remove()">Fermer</button>
    </div>
  `;
  window._historiqueAnalyses = historique || [];
  document.body.appendChild(modal);
}

function revoirAnalyseHistorique(id) {
  const h = window._historiqueAnalyses?.find(x => x.id === id);
  if (!h) return;
  document.getElementById('modal-historique-analyses')?.remove();
  document.getElementById('analyser-input').value = h.nom_recherche;
  analyseCourante = h.resultat;
  document.getElementById('analyser-result').innerHTML = construireResultatAnalyse(h.resultat, h.nom_recherche) +
    `<div style="text-align:center;margin-top:10px">
      <span style="font-size:0.72rem;color:var(--text-muted)">Résultat du ${new Date(h.created_at).toLocaleDateString('fr-FR')}</span>
    </div>`;
}

async function supprimerAnalyseHistorique(id) {
  if (!confirm('Supprimer cette analyse de l\'historique ?')) return;
  await db.from('analyses_bouteilles').delete().eq('id', id).eq('user_id', currentUser.id);
  document.getElementById('modal-historique-analyses')?.remove();
  ouvrirHistoriqueAnalyses();
}
// Substituts reconnus à quantité égale (Tubiana) — utilisés pour disponibilité et calcul de verres possibles
const SUBSTITUTIONS_INGREDIENTS = {
  'oeufs': ['aquafaba'],
  'aquafaba': ['oeufs']
};

// Retourne [id_original, ...substituts] pour un item donné
function alternativesPour(itemCaveId) {
  return [itemCaveId, ...(SUBSTITUTIONS_INGREDIENTS[itemCaveId] || [])];
}
function calculerDisponibilite(recette, caveIdsOverride) {
  const caveIds = caveIdsOverride || getItemsCave();
  const ingredientsRequis = (recette.ingredients || []).filter(i => !i.optionnel && i.item_cave_id);
  const manquants = ingredientsRequis.filter(i =>
    !alternativesPour(i.item_cave_id).some(alt => caveIds.has(alt))
  );
  return manquants.length;
}
 // Mode Fin du monde : matching par texte (nom/catégorie), pas par item_cave_id —
// les bouteilles d'opportunité ne sont jamais dans la cave cataloguée de Seb.
function calculerDisponibiliteOpportunite(recette, dispoTextes) {
  function calculerDisponibiliteOpportunite(recette, dispoTextes) {
  const ingredientsRequis = (recette.ingredients || []).filter(i => !i.optionnel);
  const manquants = ingredientsRequis.filter(ing => {
    if (ing.item_cave_id && CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) {
      return false; // ingrédient frais/générique jamais tracké — toujours considéré disponible
    }
    const key = (ing.nom || '').toLowerCase();
    return !dispoTextes.some(d => key.includes(d) || d.includes(key));
  });
  return manquants.length;
};
  const manquants = ingredientsRequis.filter(ing => {
    const key = (ing.nom || '').toLowerCase();
    return !dispoTextes.some(d => key.includes(d) || d.includes(key));
  });
  return manquants.length;
}
function calculerDisponibiliteVoyage(recette) {
  const ingredientsRequis = (recette.ingredients || []).filter(i => !i.optionnel && i.item_cave_id);
  const manquants = ingredientsRequis.filter(i => {
    if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(i.item_cave_id))) return false;
    const alternatives = alternativesPour(i.item_cave_id);
    return !voyageBouteillesActives.some(b => alternatives.includes(b.item_cave_id));
  });
  return manquants.length;
}
function badgeDisponibilite(nbManquants) {
  if (nbManquants === 0) return '<span class="badge-dispo badge-ok">✅ Réalisable</span>';
  if (nbManquants === 1) return '<span class="badge-dispo badge-1">1 manquant</span>';
  if (nbManquants === 2) return '<span class="badge-dispo badge-2">2 manquants</span>';
  return '<span class="badge-dispo badge-3">3+ manquants</span>';
}
 
// =============================================
// ONGLET RECETTES
// =============================================
 
async function chargerRecettes() {
  const [{ data: recs }, { data: ings }, { data: etapes }, { data: mats }, { data: aliases }, { data: glossaire }] = await Promise.all([
    db.from('recettes').select('*, gout_sucre, gout_amer, gout_acide, gout_fruite, gout_fume, gout_floral, gout_epice, gout_cremeux, degustation_voir, degustation_sentir, degustation_gout, degustation_finish, degustation_defi, variante_alcool, variante_prestige, variante_mocktail_id, variante_notes, prix_portion, kit_portable, photo_url'),
    db.from('recette_ingredients').select('*').order('ordre'),
    db.from('recette_etapes').select('*').order('ordre'),
    db.from('recette_materiels').select('*'),
    db.from('ingredients_alias').select('*').eq('user_id', currentUser.id),
    db.from('ingredients_glossaire').select('*').eq('user_id', currentUser.id)
  ]);

  ingredientsAlias = {};
  (aliases || []).forEach(a => { ingredientsAlias[a.nom_ingredient.toLowerCase()] = a.item_cave_id; });

  glossaireIngredients = glossaire || [];

  recettes = (recs || []).map(r => ({
    ...r,
    ingredients: (ings || []).filter(i => i.recette_id === r.id),
    etapes:      (etapes || []).filter(e => e.recette_id === r.id),
    materiels:   (mats || []).filter(m => m.recette_id === r.id)
  }));

  renderRecettes();
}
async function ouvrirLiaisonIngredient(nomIng, recetteIngId, onApresLiaison) {
  const caveItems = (cave?.categories?.flatMap(c => c.items.filter(i => i.detenu !== false)) || [])
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
  const alias = ingredientsAlias[nomIng.toLowerCase()];
  let itemSelectionne = alias || null;

const typeVersCategorie = {
    sirop: 'sirops', cordial: 'sirops', liqueur: 'liqueurs', creme: 'liqueurs',
    bitter: 'bitters', sucrant: 'garde-manger', jus: 'ingredients-frais', mixer: 'garde-manger',
    puree: 'purees-coulis'
  };

  const nomLower = nomIng.toLowerCase();
  const matchGlossaire = glossaireIngredients.find(g =>
    !g.item_cave_id && (
      g.nom_canonique.toLowerCase() === nomLower ||
      (g.alias || []).some(a => a.toLowerCase() === nomLower)
    )
  );

  const categoriesOptions = (cave?.categories || [])
    .filter(c => c.id !== 'a-acheter' && !c.id.startsWith('a-acheter'))
    .map(c => `<option value="${c.id}" ${matchGlossaire && typeVersCategorie[matchGlossaire.type] === c.id ? 'selected' : ''}>${c.icon || ''} ${c.label}</option>`).join('');

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:24px;max-width:400px;width:100%;max-height:80vh;display:flex;flex-direction:column;">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px;">🔗 Lier un ingrédient</div>
      <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px;">"${nomIng}"</div>
      <input type="text" id="recherche-alias-cave" placeholder="Rechercher une bouteille..." style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.9rem;margin-bottom:10px;">
      <div id="liste-alias-cave" style="overflow-y:auto;flex:1;min-height:0;border:1px solid var(--border);border-radius:8px;"></div>

      ${matchGlossaire ? `
      <div style="margin-top:10px;padding:10px 12px;background:var(--bg-accent);border:1px solid var(--border-accent);border-radius:8px;font-size:0.82rem;color:var(--text-accent);">
        🧪 Reconnu dans le glossaire : <strong>${matchGlossaire.nom_canonique}</strong> (${matchGlossaire.type}). Pas encore dans Ma Cave — catégorie pré-sélectionnée ci-dessous.
      </div>` : ''}

      ${(!matchGlossaire && !alias) ? `
      <button id="btn-identifier-marque" style="width:100%;padding:8px;margin-top:8px;border-radius:8px;border:1px dashed var(--border-accent);background:none;color:var(--text-accent);cursor:pointer;font-size:0.85rem;">
        ✨ Identifier "${nomIng}" (marque d'alcool ?)
      </button>
      <div id="resultat-identification" style="display:none;margin-top:8px;padding:10px;background:var(--bg-accent);border-radius:8px;font-size:0.82rem;color:var(--text-accent);"></div>
      ` : ''}

      <div id="bloc-nouvel-ingredient" style="margin-top:10px;">
        <button id="btn-toggle-nouvel" style="width:100%;padding:8px;border-radius:8px;border:1px dashed var(--border);background:none;color:var(--text-secondary);cursor:pointer;font-size:0.85rem;">
          + "${nomIng}" n'existe pas encore — le créer dans Ma Cave
        </button>
        <div id="form-nouvel-ingredient" style="display:${matchGlossaire ? 'block' : 'none'};margin-top:8px;padding:10px;background:var(--bg);border-radius:8px;border:1px solid var(--border);">
          <label style="font-size:0.78rem;color:var(--text-muted);">Catégorie</label>
          <select id="select-nouvelle-categorie" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:0.9rem;margin:4px 0 8px;">
            ${categoriesOptions}
          </select>
          <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-secondary);margin-bottom:10px;cursor:pointer;">
            <input type="checkbox" id="check-nouvel-detenu" checked style="width:16px;height:16px;accent-color:var(--accent);">
            Je le possède déjà
          </label>
          <button id="btn-creer-ingredient" style="width:100%;padding:9px;border-radius:8px;border:none;background:var(--accent);color:#000;font-weight:600;cursor:pointer;font-size:0.85rem;">
            ✅ Créer "${nomIng}"
          </button>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-top:16px;">
        <button id="btn-alias-annuler" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-muted);cursor:pointer;">Annuler</button>
        <button id="btn-alias-valider" style="flex:1;padding:10px;border-radius:8px;border:none;background:var(--accent);color:#000;font-weight:700;cursor:pointer;">✅ Lier</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  if (matchGlossaire) document.getElementById('btn-toggle-nouvel').style.display = 'none';

  const listeContainer = document.getElementById('liste-alias-cave');
  const inputRecherche = document.getElementById('recherche-alias-cave');

  const STYLES_PAR_CATEGORIE = {
    'rhum': ['Blanc/Silver', 'Ambré/Doré', 'Brun/Vieux', 'Agricole'],
    'gin': ['London Dry', 'Old Tom', 'Contemporain/Floral'],
    'mezcal-tequila': ['Tequila Blanco', 'Tequila Reposado', 'Tequila Añejo', 'Mezcal']
  };

  function categorieDeItem(itemId) {
    for (const cat of (cave?.categories || [])) {
      if (cat.items.some(i => i.id === itemId)) return cat.id;
    }
    return null;
  }

  function renderListe(filtre = '') {
    const filtreLower = filtre.toLowerCase();
    const items = caveItems.filter(i => i.nom.toLowerCase().includes(filtreLower));
    if (items.length === 0) {
      listeContainer.innerHTML = '<div style="padding:14px;color:var(--text-muted);font-size:0.85rem;text-align:center;">Aucune bouteille trouvée</div>';
      return;
    }
    listeContainer.innerHTML = items.map(i => {
      const catId = categorieDeItem(i.id);
      const stylesDispo = STYLES_PAR_CATEGORIE[catId];
      let styleHtml = '';
      if (i.sous_type_alcool) {
        styleHtml = `<div style="font-size:0.75rem;color:var(--text-accent);margin-top:2px;">🏷️ ${i.sous_type_alcool}</div>`;
      } else if (stylesDispo) {
        styleHtml = `<button class="btn-tag-style" data-id="${i.id}" data-styles="${stylesDispo.join(',')}" style="font-size:0.72rem;color:var(--text-muted);background:none;border:1px dashed var(--border);border-radius:12px;padding:1px 8px;margin-top:3px;cursor:pointer;">+ style</button>`;
      }
      return `
      <div class="item-alias-choix" data-id="${i.id}" style="padding:10px 12px;cursor:pointer;font-size:0.9rem;border-bottom:1px solid var(--border);${itemSelectionne === i.id ? 'background:var(--bg-accent);color:var(--text-accent);font-weight:600;' : ''}">
        ${i.nom}
        ${styleHtml}
      </div>`;
    }).join('');

    listeContainer.querySelectorAll('.item-alias-choix').forEach(el => {
      el.onclick = (e) => {
        if (e.target.classList.contains('btn-tag-style')) return;
        itemSelectionne = el.dataset.id;
        renderListe(inputRecherche.value);
      };
    });

    listeContainer.querySelectorAll('.btn-tag-style').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const styles = btn.dataset.styles.split(',');
        const menu = document.createElement('div');
        menu.style.cssText = 'position:absolute;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.4);z-index:10001;overflow:hidden;';
        const rect = btn.getBoundingClientRect();
        menu.style.left = rect.left + 'px';
        menu.style.top = (rect.bottom + 4) + 'px';
        menu.innerHTML = styles.map(s => `<div class="opt-style" data-style="${s}" style="padding:8px 14px;font-size:0.82rem;cursor:pointer;white-space:nowrap;">${s}</div>`).join('');
        document.body.appendChild(menu);
        menu.querySelectorAll('.opt-style').forEach(opt => {
          opt.onclick = async (ev) => {
            ev.stopPropagation();
            const itemId = btn.dataset.id;
            const sousType = opt.dataset.style;
            await db.from('items').update({ sous_type_alcool: sousType }).eq('id', itemId).eq('user_id', currentUser.id);
            const item = caveItems.find(x => x.id === itemId);
            if (item) item.sous_type_alcool = sousType;
            menu.remove();
            renderListe(inputRecherche.value);
          };
        });
        setTimeout(() => {
          document.addEventListener('click', function fermer() {
            menu.remove();
            document.removeEventListener('click', fermer);
          }, { once: true });
        }, 0);
      };
    });
  }

  renderListe();
  inputRecherche.oninput = () => renderListe(inputRecherche.value);
  setTimeout(() => inputRecherche.focus(), 50);

  document.getElementById('btn-toggle-nouvel').onclick = () => {
    document.getElementById('form-nouvel-ingredient').style.display = 'block';
    document.getElementById('btn-toggle-nouvel').style.display = 'none';
  };

  const btnIdentifier = document.getElementById('btn-identifier-marque');
  if (btnIdentifier) {
    btnIdentifier.onclick = async () => {
      btnIdentifier.disabled = true;
      btnIdentifier.textContent = '⏳ Identification...';
      try {
        const res = await fetch('/api/identifier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nom: nomIng })
        });
        const info = await res.json();
        const resultDiv = document.getElementById('resultat-identification');
        resultDiv.style.display = 'block';

        if (!info.identifie) {
          resultDiv.innerHTML = info.trop_vague
            ? '⚠️ Nom trop vague pour identifier — précisez la marque complète.'
            : '❓ Non identifié — créez l\'ingrédient manuellement ci-dessous.';
          btnIdentifier.style.display = 'none';
          document.getElementById('form-nouvel-ingredient').style.display = 'block';
          btnIdentifier.disabled = false;
          return;
        }
const recommandations = info.sous_type_alcool
          ? caveItems.filter(i => i.sous_type_alcool === info.sous_type_alcool)
          : [];

        let recoHtml = '';
        if (recommandations.length > 0) {
          recoHtml = `<div style="margin-top:6px;">Vous avez déjà : ${recommandations.map(r => `<strong>${r.nom}</strong>`).join(', ')}</div>`;
        }

        resultDiv.innerHTML = info.alcoolise === false
          ? `🥤 ${info.categorie_id} — produit non alcoolisé${recoHtml}`
          : `🏷️ ${info.categorie_id} — style : ${info.sous_type_alcool || 'non déterminé'}${info.tourbe ? ' (tourbé)' : ''}${recoHtml}`;

        // Capitalise l'identification dans le glossaire (uniquement liqueurs/bitters/sirops/mixers —
        // les spiritueux de base relèvent du futur chantier Banque d'Alcool, pas encore créé)
        const TYPE_VERS_GLOSSAIRE = {
          'liqueurs': 'liqueur', 'bitters': 'bitter', 'sirops': 'sirop',
          'sodas-mixers': 'mixer', 'triples-secs': 'liqueur'
        };
        const typeGlossaire = TYPE_VERS_GLOSSAIRE[info.categorie_id];
        if (typeGlossaire) {
          db.from('ingredients_glossaire').upsert({
            user_id: currentUser.id,
            nom_canonique: nomIng,
            alias: [nomIng.toLowerCase()],
            type: typeGlossaire,
            source: info.source_web ? 'identifier-web' : 'identifier-ia'
          }, { onConflict: 'user_id,nom_canonique' }).then(({ error }) => {
            if (error) console.error('Erreur écriture glossaire:', error.message);
          });
        }

        if (recommandations.length === 1) {
          itemSelectionne = recommandations[0].id;
          renderListe();
        } else {
          document.getElementById('select-nouvelle-categorie').value = info.categorie_id;
          document.getElementById('form-nouvel-ingredient').style.display = 'block';
          btnIdentifier.style.display = 'none';
        }
      } catch (e) {
        document.getElementById('resultat-identification').style.display = 'block';
        document.getElementById('resultat-identification').textContent = 'Erreur d\'identification.';
      }
      btnIdentifier.disabled = false;
      btnIdentifier.textContent = `✨ Identifier "${nomIng}"`;
    };
  }

  document.getElementById('btn-creer-ingredient').onclick = async () => {
    const catId = document.getElementById('select-nouvelle-categorie').value;
    const possede = document.getElementById('check-nouvel-detenu').checked;
    const btn = document.getElementById('btn-creer-ingredient');
    btn.disabled = true;
    btn.textContent = 'Création...';

    const { data: nouvelItem, error } = await db.from('items').insert({
      id: 'custom-' + Date.now(),
      user_id: currentUser.id,
      category_id: catId,
      nom: nomIng,
      detenu: possede
    }).select().single();

    if (error) {
      alert('Erreur : ' + error.message);
      btn.disabled = false;
      btn.textContent = `✅ Créer "${nomIng}"`;
      return;
    }

    const cat = cave.categories.find(c => c.id === catId);
    if (cat) cat.items.push(nouvelItem);
    if (possede) {
      caveItems.push(nouvelItem);
      caveItems.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
    }

const categorieVersType = {
  sirops: 'sirop', liqueurs: 'liqueur', bitters: 'bitter',
  'garde-manger': 'sucrant', 'ingredients-frais': 'jus', 'purees-coulis': 'puree',
  'sodas-mixers': 'mixer', 'jus-nectars': 'jus', 'cordials': 'cordial'
};

    if (matchGlossaire) {
      await db.from('ingredients_glossaire')
        .update({ item_cave_id: nouvelItem.id })
        .eq('id', matchGlossaire.id);
      matchGlossaire.item_cave_id = nouvelItem.id;
    } else if (categorieVersType[catId]) {
      const doublon = trouverDoublonPotentiel(nouvelItem.nom);
      if (doublon && confirm(`⚠️ "${nouvelItem.nom}" ressemble à "${doublon.nom_canonique}" déjà dans le glossaire.\n\nEst-ce la même chose ?\n\nOK = ajouter "${nouvelItem.nom}" comme orthographe alternative\nAnnuler = créer une entrée séparée`)) {
        await db.from('ingredients_glossaire')
          .update({ alias: [...(doublon.alias || []), nouvelItem.nom.toLowerCase()], item_cave_id: doublon.item_cave_id || nouvelItem.id })
          .eq('id', doublon.id);
        doublon.alias = [...(doublon.alias || []), nouvelItem.nom.toLowerCase()];
        if (!doublon.item_cave_id) doublon.item_cave_id = nouvelItem.id;
      } else {
        const { data: nouvelleEntreeGlossaire } = await db.from('ingredients_glossaire').insert({
          user_id: currentUser.id,
          nom_canonique: nouvelItem.nom,
          alias: [],
          type: categorieVersType[catId],
          item_cave_id: nouvelItem.id,
          source: 'manuel-liaison'
        }).select().single();
        if (nouvelleEntreeGlossaire) glossaireIngredients.push(nouvelleEntreeGlossaire);
      }
    }

    itemSelectionne = nouvelItem.id;
    await autoLierIngredientParNom(nouvelItem.nom, nouvelItem.id);

    document.getElementById('form-nouvel-ingredient').style.display = 'none';
    inputRecherche.value = '';
    renderListe();
  };

document.getElementById('btn-alias-annuler').onclick = () => { modal.remove(); if (onApresLiaison) onApresLiaison(); };
  document.getElementById('btn-alias-valider').onclick = async () => {
    const itemCaveId = itemSelectionne;
    if (!itemCaveId) { modal.remove(); return; }
    await db.from('ingredients_alias').upsert({
      user_id: currentUser.id,
      nom_ingredient: nomIng.toLowerCase(),
      item_cave_id: itemCaveId
    }, { onConflict: 'user_id,nom_ingredient' });
    await db.from('recette_ingredients')
      .update({ item_cave_id: itemCaveId })
      .eq('user_id', currentUser.id)
      .ilike('nom', nomIng);
    ingredientsAlias[nomIng.toLowerCase()] = itemCaveId;
    recettes.forEach(r => {
      r.ingredients?.forEach(ing => {
        if (ing.nom?.toLowerCase() === nomIng.toLowerCase()) {
          ing.item_cave_id = itemCaveId;
        }
      });
    });
   modal.remove();
    if (onApresLiaison) onApresLiaison(); else ouvrirFicheRecette(recetteOuverte?.id);
    alert(`✅ "${nomIng}" lié à "${(cave?.categories?.flatMap(c=>c.items).find(i=>i.id===itemCaveId))?.nom || itemCaveId}" sur toutes vos recettes.`);
  };
}
function renderRecettes() {
  const container = document.getElementById('recettes-container');
  if (!container) return;
 
  let liste = recettes.filter(r => r.type === sectionRecette);
  if (modeSelectionSoiree && !voyageActif) liste = liste.filter(r => calculerDisponibilite(r) === 0);
 
  if (filtreBase) liste = liste.filter(r => r.base_alcool === filtreBase);
  if (filtreGout) liste = liste.filter(r => r.gouts && r.gouts.includes(filtreGout));
  if (filtreDiff) liste = liste.filter(r => r.difficulte === filtreDiff);
 
if (filtreDisponible) {
    liste = [...liste].sort((a, b) => calculerDisponibilite(a) - calculerDisponibilite(b));
  }
  if (filtreDisponibleVoyage && voyageActif) {
    liste = liste.filter(r => calculerDisponibiliteVoyage(r) === 0);
    liste = [...liste].sort((a, b) => calculerDisponibiliteVoyage(a) - calculerDisponibiliteVoyage(b));
  }

  if (filtreSansLiaison) {
    liste = liste.filter(r => !(r.ingredients || []).some(i =>
      !i.item_cave_id && !i.optionnel &&
      i.quantite && (i.unite === 'cl' || i.unite === 'ml') &&
      !/glace|glaçon/i.test(i.nom || '')
    ));
  }
if (rechercheRecette) liste = liste.filter(r => 
  r.nom.toLowerCase().includes(rechercheRecette.toLowerCase()) ||
  (r.base_alcool && r.base_alcool.toLowerCase().includes(rechercheRecette.toLowerCase()))
);

let nbMatchesPriorite = 0;
  if (filtrePrioriteIngredients.length > 0) {
    liste = [...liste].sort((a, b) =>
      comptageMatchIngredients(b, filtrePrioriteIngredients, filtrePrioriteMode) -
      comptageMatchIngredients(a, filtrePrioriteIngredients, filtrePrioriteMode)
    );
    nbMatchesPriorite = liste.filter(r => comptageMatchIngredients(r, filtrePrioriteIngredients, filtrePrioriteMode) > 0).length;
  }
 
  const bases = [...new Set(recettes.filter(r => r.type === sectionRecette && r.base_alcool).map(r => r.base_alcool))].sort();
  const gouts = [...new Set(recettes.filter(r => r.type === sectionRecette).flatMap(r => r.gouts || []))].sort();
 
container.innerHTML = `
    <div class="recettes-sections">
      <button class="section-btn ${sectionRecette === 'cocktail' ? 'active' : ''}" onclick="changerSection('cocktail')">
        🍹 Cocktails <span class="section-count">${recettes.filter(r=>r.type==='cocktail').length}</span>
      </button>
      <button class="section-btn ${sectionRecette === 'mocktail' ? 'active' : ''}" onclick="changerSection('mocktail')">
        🧃 Mocktails <span class="section-count">${recettes.filter(r=>r.type==='mocktail').length}</span>
      </button>
      <button class="section-btn ${sectionRecette === 'preparation' ? 'active' : ''}" onclick="changerSection('preparation')">
        ⚗️ Préparations <span class="section-count">${recettes.filter(r=>r.type==='preparation').length}</span>
      </button>
    </div>
    <button class="btn-outline" style="margin:8px 0${voyageActif ? ';border-color:var(--accent);color:var(--accent)' : ''}" onclick="toggleModeSelectionSoiree()">
      ${modeSelectionSoiree ? '✕ Annuler la sélection' : `☑️ Sélectionner pour une soirée${voyageActif ? ' 🧳' : ''}`}
    </button>
    ${voyageActif ? `
    <button class="btn-outline" style="margin:0 0 8px 0;border-color:var(--accent);color:var(--accent);width:100%" onclick="ouvrirGenerateurRecettes()">
      ✨ Générer avec ma cave voyage
    </button>` : ''}

<div style="padding:0 0 10px 0;">
<input type="text" id="recherche-recettes"
placeholder="🔍 Rechercher une recette…" 
    value="${rechercheRecette}"
oninput="rechercheRecette=this.value; clearTimeout(window._debounceRecherche); window._debounceRecherche=setTimeout(()=>{renderRecettes(); const i=document.querySelector('#recherche-recettes');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}},220)"    
style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:0.95rem;outline:none;">
</div>
<div class="recettes-filtres">
      <select onchange="filtreBase=this.value; renderRecettes()">
        <option value="">Toutes les bases</option>
        ${bases.map(b => `<option value="${b}" ${filtreBase===b?'selected':''}>${b}</option>`).join('')}
      </select>
      <select onchange="filtreGout=this.value; renderRecettes()">
        <option value="">Tous les goûts</option>
        ${gouts.map(g => `<option value="${g}" ${filtreGout===g?'selected':''}>${g}</option>`).join('')}
      </select>
      <select onchange="filtreDiff=this.value; renderRecettes()">
        <option value="">Toutes difficultés</option>
        <option value="facile" ${filtreDiff==='facile'?'selected':''}>Facile</option>
        <option value="moyen" ${filtreDiff==='moyen'?'selected':''}>Moyen</option>
        <option value="avance" ${filtreDiff==='avance'?'selected':''}>Avancé</option>
      </select>
<button class="btn-filtre-dispo ${filtreDisponible ? 'active' : ''}" onclick="filtreDisponible=!filtreDisponible; renderRecettes()">
  ✅ Réalisables maintenant
</button>
${voyageActif ? `
<button class="btn-filtre-dispo ${filtreDisponibleVoyage ? 'active' : ''}" onclick="filtreDisponibleVoyage=!filtreDisponibleVoyage; renderRecettes()">
  🧳 Réalisables voyage
</button>` : ''}
<button class="btn-filtre-dispo ${filtreSansLiaison ? 'active' : ''}" onclick="filtreSansLiaison=!filtreSansLiaison; renderRecettes()">
  🔗 Sans liaisons
</button>
<button class="btn-filtre-dispo ${filtrePrioriteIngredients.length > 0 ? 'active' : ''}" onclick="ouvrirPrioriteIngredients()">
  🎯 Prioriser${filtrePrioriteIngredients.length > 0 ? ' (' + filtrePrioriteIngredients.length + ')' : ''}
</button>
    </div>
 
${voyageActif && modeSelectionSoiree ? `
  <div style="background:var(--bg-accent);border:1px solid var(--border-accent);border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:0.78rem;color:var(--text-accent)">
    🧳 Sélection filtrée sur ta cave <strong>${voyageActif.nom}</strong> — ${liste.filter(r => calculerDisponibiliteVoyage(r) === 0).length} recette${liste.filter(r => calculerDisponibiliteVoyage(r) === 0).length > 1 ? 's' : ''} réalisable${liste.filter(r => calculerDisponibiliteVoyage(r) === 0).length > 1 ? 's' : ''}
  </div>` : ''}
<div class="recettes-grille">
      ${liste.length === 0 ? '<div class="empty-state">Aucune recette trouvée.</div>' : ''}
      ${liste.map((r, index) => {
        const separateur = filtrePrioriteIngredients.length > 0 && index === nbMatchesPriorite && nbMatchesPriorite > 0 && nbMatchesPriorite < liste.length
          ? `<div style="grid-column:1/-1;display:flex;align-items:center;gap:10px;margin:8px 0;color:var(--text-muted);font-size:0.78rem">
              <div style="flex:1;height:1px;background:var(--border)"></div>
              Le reste des recettes
              <div style="flex:1;height:1px;background:var(--border)"></div>
             </div>`
          : '';
        return separateur + renderCarteRecette(r);
      }).join('')}
    </div>
  `;
  ouvrirBarreSelectionSoiree();
}
 
// =============================================
// CARTE RECETTE — avec photo_url
// =============================================

let stockReserveActif = [];

async function chargerStockReserve() {
  const { data } = await db.from('stock_reserve').select('*').eq('user_id', currentUser.id);
  // Une réservation ne protège plus rien une fois sa date passée — pas de nettoyage à faire, juste ignorée
  const aujourdhui = new Date().toISOString().slice(0, 10);
  stockReserveActif = (data || []).filter(r => !r.date_evenement || r.date_evenement >= aujourdhui);
}

function clReserveePour(itemId) {
  return stockReserveActif.filter(r => r.item_id === itemId).reduce((s, r) => s + r.cl_reserve, 0);
}
const CATEGORIES_NON_TRACKEES = ['ingredients-frais', 'garde-manger', 'ponctuels'];

function categorieDeItemGlobal(itemId) {
  for (const cat of (cave?.categories || [])) {
    if (cat.items.some(i => i.id === itemId)) return cat.id;
  }
  return null;
}
function calculerVerresPossibles(recette) {
const tousIngs = (recette.ingredients || []).filter(i =>
    i.quantite && (i.unite === 'cl' || i.unite === 'ml') && !i.optionnel &&
    !/glace|glaçon/i.test(i.nom || '')
  );
  if (tousIngs.length === 0) return null;

  let max = Infinity;
  let inconnu = false;

tousIngs.forEach(ing => {
    if (!ing.item_cave_id) { inconnu = true; return; }
    if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) return;
    const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
    if (qteCl <= 0) return;

    // Meilleur résultat parmi l'item d'origine et ses substituts reconnus (ex: œuf / aquafaba)
    let meilleurPossibles = null;
    let auMoinsUnConnu = false;
    alternativesPour(ing.item_cave_id).forEach(altId => {
      const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === altId);
      if (!item || item.cl_restants === null || item.cl_restants === undefined) return;
      auMoinsUnConnu = true;
      const disponibleReel = Math.max(0, item.cl_restants - clReserveePour(item.id));
      const possibles = Math.floor(disponibleReel / qteCl);
      if (meilleurPossibles === null || possibles > meilleurPossibles) meilleurPossibles = possibles;
    });

    if (!auMoinsUnConnu) { inconnu = true; return; }
    if (meilleurPossibles < max) max = meilleurPossibles;
  });

  if (max === Infinity) return null;
  return { max, partiel: inconnu };
}
function calculerVerresPossiblesVoyage(recette) {
  if (!voyageActif) return null;
  const tousIngs = (recette.ingredients || []).filter(i =>
    i.quantite && (i.unite === 'cl' || i.unite === 'ml') && !i.optionnel
  );
  if (tousIngs.length === 0) return null;

  let max = Infinity;
  let horsVoyage = false;

  tousIngs.forEach(ing => {
    if (!ing.item_cave_id) { horsVoyage = true; return; }
    const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
    if (qteCl <= 0) return;

    let meilleurPossibles = null;
    alternativesPour(ing.item_cave_id).forEach(altId => {
      const bouteille = voyageBouteillesActives.find(b => b.item_cave_id === altId);
      if (!bouteille || bouteille.cl_restants_voyage === null) return;
      const possibles = Math.floor(bouteille.cl_restants_voyage / qteCl);
      if (meilleurPossibles === null || possibles > meilleurPossibles) meilleurPossibles = possibles;
    });

    if (meilleurPossibles === null) { horsVoyage = true; return; }
    if (meilleurPossibles < max) max = meilleurPossibles;
  });

  if (max === Infinity || horsVoyage) return { max: 0, indisponible: true };
  return { max, indisponible: false };
}


function toggleModeSelectionSoiree() {
  modeSelectionSoiree = !modeSelectionSoiree;
  if (!modeSelectionSoiree) {
    recettesSelectionneesSoiree.clear();
  } else if (soireeMenuActive) {
    // Soirée en cours — proposer d'y ajouter directement
    const div = document.createElement('div');
    div.id = 'bandeau-soiree-active';
    div.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:var(--bg-accent);border-top:2px solid var(--border-accent);padding:10px 16px;z-index:500;display:flex;justify-content:space-between;align-items:center';
    div.innerHTML = `
      <span style="font-size:0.85rem;color:var(--text-accent);font-weight:600">🎉 Soirée en cours : ${soireeMenuActive.nom}</span>
      <div style="display:flex;gap:8px">
        <button class="btn-outline" style="font-size:0.8rem;padding:4px 10px" onclick="ajouterSelectionASoireeActive()">+ Ajouter au menu</button>
        <button style="background:none;border:none;color:var(--text-muted);cursor:pointer" onclick="document.getElementById('bandeau-soiree-active')?.remove()">✕</button>
      </div>
    `;
    document.body.appendChild(div);
  }
  renderRecettes();
}

async function ajouterSelectionASoireeActive() {
  if (!soireeMenuActive) return;
  // Chercher les recettes cochées ou toutes si aucune sélection
  const ids = recettesSelectionneesSoiree.size > 0
    ? [...recettesSelectionneesSoiree]
    : null;
  if (!ids) { alert('Sélectionne d\'abord des recettes à ajouter.'); return; }

  for (const recetteId of ids) {
    const dejaPresente = soireeMenuRecettesActives.some(mr => mr.recette_id === recetteId);
    if (dejaPresente) continue;
    const { data } = await db.from('soiree_menu_recettes').insert({
      id: 'smr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      soiree_menu_id: soireeMenuActive.id,
      recette_id: recetteId,
      portions_prevues: 1,
      ordre: soireeMenuRecettesActives.length
    }).select().single();
    if (data) soireeMenuRecettesActives.push(data);
  }

  recettesSelectionneesSoiree.clear();
  modeSelectionSoiree = false;
  document.getElementById('bandeau-soiree-active')?.remove();
  alert(`${ids.length} cocktail${ids.length > 1 ? 's' : ''} ajouté${ids.length > 1 ? 's' : ''} à ${soireeMenuActive.nom}`);
  renderRecettes();
}
let voyageActif = null;
let modeSelectionVoyage = false;
let bouteillesSelectionneesVoyage = new Set();

let voyageBouteillesActives = [];

async function chargerVoyageActif() {
  const { data } = await db.from('mode_voyage').select('*').eq('user_id', currentUser.id).eq('statut', 'actif').maybeSingle();
  voyageActif = data || null;
  if (voyageActif) {
    const { data: bouteilles } = await db.from('mode_voyage_bouteilles').select('*').eq('mode_voyage_id', voyageActif.id);
    voyageBouteillesActives = bouteilles || [];
  } else {
    voyageBouteillesActives = [];
  }
  renderBandeauVoyageGlobal();

  // Restaurer la dernière soirée active en mémoire
  const { data: dernieresSoirees } = await db.from('soiree_menu')
    .select('*')
    .eq('user_id', currentUser.id)
    .not('statut', 'eq', 'termine')
    .order('created_at', { ascending: false })
    .limit(1);
  if (dernieresSoirees?.length > 0) {
    soireeMenuActive = dernieresSoirees[0];
    const { data: mrs } = await db.from('soiree_menu_recettes')
      .select('*').eq('soiree_menu_id', soireeMenuActive.id).order('ordre');
    soireeMenuRecettesActives = mrs || [];
  }
}
function renderBandeauVoyageGlobal() {
  const el = document.getElementById('bandeau-voyage-global');
  if (!el) return;

  if (!voyageActif) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = `
    <div onclick="ouvrirTableauBordVoyage()" style="cursor:pointer;background:linear-gradient(90deg,#d9a441,#f2c464);color:#10141f;padding:10px 16px;text-align:center;font-weight:700;font-size:0.88rem;display:flex;align-items:center;justify-content:center;gap:8px;animation:pulseVoyage 2.2s ease-in-out infinite">
      <span style="font-size:1.1rem">🧳</span> Mode Voyage actif — ${voyageActif.nom} <span style="font-size:0.75rem;font-weight:400;opacity:0.7">(toucher pour gérer)</span>
    </div>
    <style>
      @keyframes pulseVoyage { 0%,100% { opacity:1 } 50% { opacity:0.75 } }
    </style>
  `;
}
function toggleSelectionBouteilleVoyage(itemId, event) {
  event.stopPropagation();
  if (bouteillesSelectionneesVoyage.has(itemId)) bouteillesSelectionneesVoyage.delete(itemId);
  else bouteillesSelectionneesVoyage.add(itemId);
  renderCave();
}
async function lancerModeVoyageDepuisSelection() {
  if (bouteillesSelectionneesVoyage.size === 0) { alert('Sélectionne au moins une bouteille.'); return; }
  const nom = prompt('Nom du voyage ?', 'Mon voyage');
  if (!nom || !nom.trim()) return;

  const { data: voyage, error } = await db.from('mode_voyage').insert({
    id: 'voyage-' + Date.now(),
    user_id: currentUser.id,
    nom: nom.trim()
  }).select().single();

  if (error) { alert('Erreur : ' + error.message); return; }

const toutesItems = cave.categories.flatMap(c => c.items);
  voyageBouteillesActives = [];
  for (const itemId of bouteillesSelectionneesVoyage) {
    const item = toutesItems.find(i => i.id === itemId);
    if (!item) continue;
    const { data: bouteilleCreee } = await db.from('mode_voyage_bouteilles').insert({
      id: 'mvb-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      mode_voyage_id: voyage.id,
      item_cave_id: itemId,
      nom: item.nom,
      cl_restants_voyage: item.cl_restants,
      cl_restants_origine: item.cl_restants
    }).select().single();
    if (bouteilleCreee) voyageBouteillesActives.push(bouteilleCreee);
  }
voyageActif = voyage;
  renderBandeauVoyageGlobal();
  modeSelectionVoyage = false;
  bouteillesSelectionneesVoyage.clear();
  renderCave();
  ouvrirTableauBordVoyage();
}
async function ouvrirTableauBordVoyage() {
  if (!voyageActif) return;

  const { data: bouteilles } = await db.from('mode_voyage_bouteilles').select('*').eq('mode_voyage_id', voyageActif.id);
    const { data: soirees } = await db.from('soiree_menu').select('*').eq('voyage_id', voyageActif.id).order('created_at');

  let modal = document.getElementById('modal-tableau-bord-voyage');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-tableau-bord-voyage';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9000;overflow-y:auto;padding:20px';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="max-width:600px;margin:0 auto;background:var(--bg-card);border-radius:16px;padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="font-size:1.1rem;font-weight:700;color:var(--accent)">🧳 ${voyageActif.nom}</div>
        <button onclick="document.getElementById('modal-tableau-bord-voyage').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1.3rem;cursor:pointer">✕</button>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:16px">Actif depuis le ${new Date(voyageActif.date_debut).toLocaleDateString('fr-FR')}</div>

<div style="font-size:0.85rem;font-weight:600;margin-bottom:8px">🎉 Soirées</div>
      ${(soirees || []).length === 0
        ? '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Aucune soirée pour ce voyage.</div>'
        : (soirees || []).map((s, idx) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="flex:1;display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer" onclick="document.getElementById('modal-tableau-bord-voyage').remove(); ouvrirTableauBordSoiree('${s.id}')">
              <div>
                <div style="font-size:0.88rem;font-weight:600">Soirée ${idx + 1} — ${s.nom}</div>
                <div style="font-size:0.72rem;color:var(--text-muted)">${s.date_evenement ? new Date(s.date_evenement).toLocaleDateString('fr-FR') : 'Sans date'} · ${s.statut || 'planification'}</div>
              </div>
              <span style="color:var(--text-muted);font-size:1rem">›</span>
            </div>
            <button style="background:none;border:none;color:var(--text-danger);font-size:1.1rem;cursor:pointer;padding:8px" onclick="supprimerSoireeVoyage('${s.id}')">🗑</button>
          </div>
        `).join('')
      }
      <button class="btn-outline" style="width:100%;margin-bottom:20px;font-size:0.85rem" onclick="document.getElementById('modal-tableau-bord-voyage').remove(); creerSoireeMenuSolo('${voyageActif.id}')">+ Nouvelle soirée</button>

<div style="font-size:0.85rem;font-weight:600;margin-bottom:8px">🍾 Bouteilles emportées</div>
      <button class="btn-outline" style="width:100%;margin-bottom:10px;font-size:0.85rem" onclick="ouvrirAjoutBouteilleVoyage()">+ Ajouter une bouteille</button>
      ${(() => {
        if (!(bouteilles || []).length) return '<div style="font-size:0.8rem;color:var(--text-muted)">Aucune bouteille.</div>';

        // Regroupe les bouteilles voyage par catégorie réelle (même logique que la cave normale)
        const groupes = {};
        bouteilles.forEach(b => {
          const catId = categorieDeItemGlobal(b.item_cave_id) || 'autre';
          if (!groupes[catId]) groupes[catId] = [];
          groupes[catId].push(b);
        });

        const catsOrdre = (cave?.categories || []).map(c => c.id);
        const idsTries = Object.keys(groupes).sort((a, b) => {
          const ia = catsOrdre.indexOf(a), ib = catsOrdre.indexOf(b);
          return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });

        return idsTries.map(catId => {
          const catInfo = (cave?.categories || []).find(c => c.id === catId);
          const label = catInfo?.label || 'Autre';
          const icon = catInfo?.icon || '📦';
          return `
            <div style="margin-bottom:14px">
              <div style="font-size:0.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:6px">${icon} ${label}</div>
              ${groupes[catId].map(b => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.88rem">
                  <span>${b.nom}</span>
                  <div style="display:flex;align-items:center;gap:10px">
                    <span style="color:var(--text-accent)">${b.cl_restants_voyage ?? '—'} cl</span>
                    <button class="btn-icon" style="color:var(--text-danger)" onclick="retirerBouteilleVoyage('${b.id}')">🗑</button>
                  </div>
                </div>
              `).join('')}
            </div>
          `;
        }).join('');
      })()}
      <button class="btn-outline" style="width:100%;margin-top:20px;border-color:var(--text-danger);color:var(--text-danger)" onclick="ouvrirBilanVoyage()">🏁 Terminer le voyage</button>
    </div>
  `;
}




async function retirerBouteilleVoyage(mvbId) {
  if (!confirm('Retirer cette bouteille du voyage ?')) return;
  await db.from('mode_voyage_bouteilles').delete().eq('id', mvbId);
  voyageBouteillesActives = voyageBouteillesActives.filter(b => b.id !== mvbId);
  ouvrirTableauBordVoyage();
}

function ouvrirAjoutBouteilleVoyage() {
  const idsDejaVoyage = voyageBouteillesActives.map(b => b.item_cave_id);
  const disponibles = cave.categories.flatMap(c => c.items)
    .filter(i => i.detenu !== false && !idsDejaVoyage.includes(i.id));

  let ongletActifVoyage = 'cave';

  const modal = document.createElement('div');
  modal.id = 'modal-ajout-bouteille-voyage';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9800;overflow-y:auto;padding:20px';

  function renderModal() {
    modal.innerHTML = `
      <div style="max-width:500px;margin:0 auto;background:var(--bg-card);border-radius:16px;padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-size:1rem;font-weight:700">+ Ajouter une bouteille</div>
          <button onclick="document.getElementById('modal-ajout-bouteille-voyage').remove(); ouvrirTableauBordVoyage()" style="background:none;border:none;color:var(--text-muted);font-size:1.3rem;cursor:pointer">✕</button>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:16px">
          <button class="btn-outline ${ongletActifVoyage === 'cave' ? 'active' : ''}" style="flex:1;${ongletActifVoyage === 'cave' ? 'background:var(--bg-accent);color:var(--text-accent);border-color:var(--border-accent)' : ''}"
            onclick="window._ongletVoyage('cave')">Depuis ma cave</button>
          <button class="btn-outline ${ongletActifVoyage === 'nouveau' ? 'active' : ''}" style="flex:1;${ongletActifVoyage === 'nouveau' ? 'background:var(--bg-accent);color:var(--text-accent);border-color:var(--border-accent)' : ''}"
            onclick="window._ongletVoyage('nouveau')">Nouvelle bouteille</button>
        </div>

        ${ongletActifVoyage === 'cave' ? `
          <input type="text" id="recherche-cave-voyage" placeholder="Rechercher..." value=""
            style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);margin-bottom:10px;box-sizing:border-box"
            oninput="window._filtrerCaveVoyage(this.value)">
          <div id="liste-cave-voyage" style="max-height:300px;overflow-y:auto">
            ${disponibles.length === 0
              ? '<div style="font-size:0.8rem;color:var(--text-muted)">Toutes tes bouteilles sont déjà dans le voyage.</div>'
              : disponibles.map(i => `
                <div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"
                  onclick="window._ajouterDepuisCave('${i.id}', '${i.nom.replace(/'/g, "\\'")}', ${i.cl_restants ?? 0})"
                  onmouseover="this.style.background='var(--bg-card-hover)'" onmouseout="this.style.background=''">
                  <span style="font-size:0.88rem">${i.nom}</span>
                  <span style="font-size:0.75rem;color:var(--text-muted)">${i.cl_restants ?? '—'} cl</span>
                </div>
              `).join('')}
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:10px">
            <input type="text" id="nouveau-nom-voyage" placeholder="Nom de la bouteille" 
              style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);box-sizing:border-box">
            <select id="nouveau-cat-voyage" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary)">
              ${cave.categories.filter(c => !['equipements', 'verres'].includes(c.id)).map(c =>
                `<option value="${c.id}">${c.label || c.id}</option>`
              ).join('')}
            </select>
            <div style="display:flex;gap:8px">
              <input type="number" id="nouveau-cl-voyage" placeholder="Contenance (cl)" min="0" step="0.5"
                style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary)">
              <input type="number" id="nouveau-prix-voyage" placeholder="Prix (€)" min="0" step="0.5"
                style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary)">
            </div>
            <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;cursor:pointer">
              <input type="checkbox" id="nouveau-detenu-voyage" checked> Je l\'ai déjà avec moi
            </label>
            <button class="btn-primary" style="width:100%;padding:12px" onclick="window._creerNouvellesBouteilleVoyage()">
              ✅ Créer et ajouter au voyage
            </button>
          </div>
        `}
      </div>
    `;

    window._ongletVoyage = (o) => { ongletActifVoyage = o; renderModal(); };

    window._filtrerCaveVoyage = (q) => {
      const liste = document.getElementById('liste-cave-voyage');
      if (!liste) return;
      const filtrees = disponibles.filter(i => i.nom.toLowerCase().includes(q.toLowerCase()));
      liste.innerHTML = filtrees.length === 0
        ? '<div style="font-size:0.8rem;color:var(--text-muted)">Aucune bouteille trouvée.</div>'
        : filtrees.map(i => `
          <div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"
            onclick="window._ajouterDepuisCave('${i.id}', '${i.nom.replace(/'/g, "\\'")}', ${i.cl_restants ?? 0})"
            onmouseover="this.style.background='var(--bg-card-hover)'" onmouseout="this.style.background=''">
            <span style="font-size:0.88rem">${i.nom}</span>
            <span style="font-size:0.75rem;color:var(--text-muted)">${i.cl_restants ?? '—'} cl</span>
          </div>
        `).join('');
    };

    window._ajouterDepuisCave = async (itemId, nomItem, clRestants) => {
      const { data } = await db.from('mode_voyage_bouteilles').insert({
        id: 'mvb-' + Date.now(),
        mode_voyage_id: voyageActif.id,
        item_cave_id: itemId,
        nom: nomItem,
        cl_restants_voyage: clRestants,
        cl_restants_origine: clRestants
      }).select().single();
      if (data) voyageBouteillesActives.push(data);
      modal.remove();
      ouvrirTableauBordVoyage();
    };

    window._creerNouvellesBouteilleVoyage = async () => {
      const nom = document.getElementById('nouveau-nom-voyage').value.trim();
      const catId = document.getElementById('nouveau-cat-voyage').value;
      const cl = parseFloat(document.getElementById('nouveau-cl-voyage').value) || null;
      const prix = parseFloat(document.getElementById('nouveau-prix-voyage').value) || null;
      const detenu = document.getElementById('nouveau-detenu-voyage').checked;

      if (!nom) { alert('Donne un nom à la bouteille.'); return; }

      const { data: nouvelItem, error } = await db.from('items').insert({
        id: 'custom-' + Date.now(),
        user_id: currentUser.id,
        category_id: catId,
        nom,
        detenu,
        cl_total: cl,
        cl_restants: cl,
        prix_estime: prix
      }).select().single();

      if (error) { alert('Erreur : ' + error.message); return; }

      // Intégrer dans la cave locale
      const cat = cave.categories.find(c => c.id === catId);
      if (cat) cat.items.push(nouvelItem);

      // Glossaire + auto-liaison recettes
      const categorieVersType = {
        sirops: 'sirop', liqueurs: 'liqueur', bitters: 'bitter',
        'garde-manger': 'sucrant', 'ingredients-frais': 'jus', 'purees-coulis': 'puree'
      };
      const doublon = trouverDoublonPotentiel(nouvelItem.nom);
      if (doublon && confirm(`⚠️ "${nouvelItem.nom}" ressemble à "${doublon.nom_canonique}" déjà dans le glossaire.\n\nEst-ce la même chose ?\n\nOK = fusionner\nAnnuler = créer séparément`)) {
        await db.from('ingredients_glossaire')
          .update({ alias: [...(doublon.alias || []), nouvelItem.nom.toLowerCase()], item_cave_id: doublon.item_cave_id || nouvelItem.id })
          .eq('id', doublon.id);
      } else if (categorieVersType[catId]) {
        await db.from('ingredients_glossaire').insert({
          user_id: currentUser.id,
          nom_canonique: nouvelItem.nom,
          alias: [],
          type: categorieVersType[catId],
          item_cave_id: nouvelItem.id,
          source: 'voyage'
        });
      }
      await autoLierIngredientParNom(nouvelItem.nom, nouvelItem.id);

      // Ajouter au voyage
      const { data: mvb } = await db.from('mode_voyage_bouteilles').insert({
        id: 'mvb-' + Date.now(),
        mode_voyage_id: voyageActif.id,
        item_cave_id: nouvelItem.id,
        nom: nouvelItem.nom,
        cl_restants_voyage: cl,
        cl_restants_origine: cl
      }).select().single();
      if (mvb) voyageBouteillesActives.push(mvb);

      modal.remove();
      renderCave();
      ouvrirTableauBordVoyage();
    };
  }

  renderModal();
  document.body.appendChild(modal);
}
function toggleSelectionRecette(id, event) {
  event.stopPropagation();
  if (recettesSelectionneesSoiree.has(id)) recettesSelectionneesSoiree.delete(id);
  else recettesSelectionneesSoiree.add(id);
  renderRecettes();
}

function ouvrirBarreSelectionSoiree() {
  let barre = document.getElementById('barre-selection-soiree');
  if (recettesSelectionneesSoiree.size === 0) {
    if (barre) barre.remove();
    return;
  }
  if (!barre) {
    barre = document.createElement('div');
    barre.id = 'barre-selection-soiree';
    barre.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:var(--bg-card);border-top:1px solid var(--border-accent);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;z-index:5000;gap:10px';
    document.body.appendChild(barre);
  }
  barre.innerHTML = `
    <span style="font-size:0.85rem">${recettesSelectionneesSoiree.size} sélectionnée${recettesSelectionneesSoiree.size > 1 ? 's' : ''}</span>
    <div style="display:flex;gap:8px">
      ${soireeMenuActive ? `
      <button class="btn-outline" style="padding:8px 12px;font-size:0.82rem;border-color:var(--accent);color:var(--accent)" onclick="ajouterSelectionASoireeActive()">
        + "${soireeMenuActive.nom}"
      </button>` : ''}
      <button class="btn-primary" style="padding:8px 16px;font-size:0.82rem" onclick="lancerSoireeDepuisSelection()">🎉 Nouvelle soirée</button>
    </div>
  `;
}

function lancerSoireeDepuisSelection() {
  selectionPourSoireeEnAttente = Array.from(recettesSelectionneesSoiree);
  modeSelectionSoiree = false;
  recettesSelectionneesSoiree.clear();
  const barre = document.getElementById('barre-selection-soiree');
  if (barre) barre.remove();
  renderRecettes();
  ouvrirChoixTypeSession();
}
function renderCarteRecette(r) {
  const nbManquants = voyageActif ? calculerDisponibiliteVoyage(r) : calculerDisponibilite(r);
  const diffLabel   = { facile: 'Facile', moyen: 'Moyen', avance: 'Avancé' }[r.difficulte] || r.difficulte;
  const diffClass   = { facile: 'diff-facile', moyen: 'diff-moyen', avance: 'diff-avance' }[r.difficulte] || '';
 
  // Image ou fallback initiale
 const cadreRecette = r.photo_cadrage
    ? `style="position:absolute;top:50%;left:50%;width:100%;height:auto;max-width:none;transform:translate(calc(-50% + ${r.photo_cadrage.x}%), calc(-50% + ${r.photo_cadrage.y}%)) scale(${r.photo_cadrage.zoom});"`
    : '';
  const imgHtml = r.photo_url
    ? `<div class="carte-img-wrap" style="${r.photo_cadrage ? 'position:relative;background:#000' : ''}">
        <img src="${r.photo_url}" alt="${r.nom}" class="${r.photo_cadrage ? '' : 'carte-img'}" loading="lazy" ${cadreRecette}
          onerror="this.parentElement.innerHTML='<span class=carte-img-initiale>${r.nom.charAt(0)}</span>'; this.parentElement.classList.add('carte-img--fallback')">
        <span class="carte-badge-dispo">${badgeDisponibilite(nbManquants)}</span>
       </div>`
    : `<div class="carte-img-wrap carte-img--fallback">
        <span class="carte-img-initiale">${r.nom.charAt(0)}</span>
        <span class="carte-badge-dispo">${badgeDisponibilite(nbManquants)}</span>
       </div>`;
 
const selectionnee = recettesSelectionneesSoiree.has(r.id);

  return `
    <div class="carte-recette" onclick="${modeSelectionSoiree ? `toggleSelectionRecette('${r.id}', event)` : `ouvrirFicheRecette('${r.id}')`}" style="${modeSelectionSoiree && selectionnee ? 'outline:2px solid var(--accent);outline-offset:-2px' : ''}">
      ${modeSelectionSoiree ? `<div style="position:absolute;top:8px;left:8px;z-index:5;width:22px;height:22px;border-radius:6px;background:${selectionnee ? 'var(--accent)' : 'rgba(0,0,0,0.5)'};border:1px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;color:#000;font-size:0.85rem">${selectionnee ? '✓' : ''}</div>` : ''}
      ${imgHtml}
      <div class="carte-body">
        <div class="carte-top">
          <div class="carte-nom">${r.nom}</div>
          <span class="carte-diff ${diffClass}">${diffLabel}</span>
        </div>
        ${r.base_alcool ? `<div class="carte-base">🥃 ${r.base_alcool}</div>` : ''}
        <div class="carte-gouts">
          ${(r.gouts || []).map(g => `<span class="tag-gout">${g}</span>`).join('')}
        </div>
<div class="carte-footer">
          ${r.prix_portion ? `<span class="carte-prix">~${r.prix_portion.toFixed(2)}€</span>` : ''}
${(() => {
  if (voyageActif) {
    const vpv = calculerVerresPossiblesVoyage(r);
    if (!vpv) return '';
    const couleur = vpv.max === 0 ? 'var(--text-danger)' : vpv.max <= 2 ? 'var(--text-warning)' : 'var(--text-success)';
    return `<span style="font-size:0.75rem;color:${couleur};font-weight:600">🧳 ${vpv.max} verre${vpv.max > 1 ? 's' : ''}</span>`;
  }
  const vp = calculerVerresPossibles(r);
  if (!vp) return '';
  const couleur = vp.max === 0 ? 'var(--text-danger)' : vp.max <= 2 ? 'var(--text-warning)' : 'var(--text-success)';
  return `<span style="font-size:0.75rem;color:${couleur};font-weight:600">🍸 ${vp.max} verre${vp.max > 1 ? 's' : ''}${vp.partiel ? '*' : ''}</span>`;
})()}
${(() => {
  const aLier = (r.ingredients || []).some(i =>
    !i.item_cave_id && !i.optionnel &&
    i.quantite && (i.unite === 'cl' || i.unite === 'ml') &&
    !/glace|glaçon/i.test(i.nom || '')
  );
  return aLier ? `<span style="font-size:0.72rem;color:var(--text-warning);font-weight:600;margin-left:4px" title="Ingrédient(s) non lié(s) à Ma Cave">⚠️ lier</span>` : '';
})()}
${!r.photo_url ? `<span style="font-size:0.72rem;color:var(--text-secondary);font-weight:600;margin-left:4px;cursor:pointer" title="Ajouter une photo" onclick="event.stopPropagation(); ouvrirValidationPhoto('${r.id}')">📷</span>` : ''}
          ${filtrePrioriteIngredients.length > 0 && comptageMatchIngredients(r, filtrePrioriteIngredients, filtrePrioriteMode) > 0 ? `<span style="font-size:0.72rem;color:var(--text-accent);font-weight:600;margin-left:4px" title="Correspond à ta priorité d'ingrédients">🎯</span>` : ''}
        </div>
      </div>
    </div>
  `;
}
// Calcule le score de correspondance d'une recette avec les ingrédients priorisés
function comptageMatchIngredients(recette, prioriteIds, mode) {
  const idsRecette = (recette.ingredients || []).map(i => i.item_cave_id).filter(Boolean);
  const matches = prioriteIds.filter(id => idsRecette.includes(id));
  if (mode === 'ET') return matches.length === prioriteIds.length ? 1 : 0;
  return matches.length;
}

// Liste les ingrédients de la cave (ou cave voyage) réellement utilisés dans au moins une recette
function listeIngredientsPriorisables() {
  const idsUtilises = new Set();
  recettes.forEach(r => (r.ingredients || []).forEach(i => { if (i.item_cave_id) idsUtilises.add(i.item_cave_id); }));

  const bouteilles = voyageActif
    ? voyageBouteillesActives
    : cave?.categories?.flatMap(c => c.items).filter(i => i.detenu !== false) || [];

const vues = new Set();
  return bouteilles
    .filter(b => idsUtilises.has(voyageActif ? b.item_cave_id : b.id))
    .map(b => ({ id: voyageActif ? b.item_cave_id : b.id, nom: b.nom }))
    .filter(ing => {
      if (vues.has(ing.id)) return false;
      vues.add(ing.id);
      return true;
    })
.sort((a, b) => a.nom.localeCompare(b.nom));
}

// Ouvre le sélecteur
function ouvrirPrioriteIngredients() {
  const ingredients = listeIngredientsPriorisables();
  const modal = document.createElement('div');
  modal.id = 'modal-priorite-ingredients';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="max-width:420px;width:100%;background:var(--bg-card);border-radius:16px;padding:20px;max-height:85vh;display:flex;flex-direction:column">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px">🎯 Prioriser des ingrédients</div>
      <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px">Les recettes utilisant ces ingrédients remonteront en premier${voyageActif ? ' (cave voyage)' : ''}.</div>
      <input type="text" id="recherche-priorite-ingredients" placeholder="🔍 Rechercher…"
        oninput="filtrerListePrioriteIngredients(this.value)"
        style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.85rem;margin-bottom:10px">
      <div id="liste-priorite-ingredients" style="overflow-y:auto;flex:1;margin-bottom:14px">
        ${ingredients.length === 0 ? '<div style="font-size:0.8rem;color:var(--text-muted)">Aucun ingrédient priorisable trouvé.</div>' : ''}
        ${ingredients.map(ing => `
          <label style="display:flex;align-items:center;gap:8px;padding:8px 4px;font-size:0.85rem;cursor:pointer" data-nom="${ing.nom.toLowerCase()}">
            <input type="checkbox" value="${ing.id}" ${filtrePrioriteIngredients.includes(ing.id) ? 'checked' : ''}
              onchange="toggleIngredientPriorite('${ing.id}')">
            ${ing.nom}
          </label>
        `).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <span style="font-size:0.8rem;color:var(--text-secondary)">Combinaison :</span>
        <button class="btn-outline" style="flex:1;padding:8px"
          onclick="filtrePrioriteMode = filtrePrioriteMode === 'OU' ? 'ET' : 'OU'; document.getElementById('label-mode-priorite').textContent = filtrePrioriteMode === 'OU' ? 'OU (au moins un)' : 'ET (tous)';">
          <span id="label-mode-priorite">${filtrePrioriteMode === 'OU' ? 'OU (au moins un)' : 'ET (tous)'}</span>
        </button>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-outline" style="flex:1" onclick="filtrePrioriteIngredients=[]; document.getElementById('modal-priorite-ingredients').remove(); renderRecettes()">Réinitialiser</button>
        <button class="btn-primary" style="flex:1" onclick="document.getElementById('modal-priorite-ingredients').remove(); renderRecettes()">✅ Appliquer</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function toggleIngredientPriorite(id) {
  const index = filtrePrioriteIngredients.indexOf(id);
  if (index === -1) filtrePrioriteIngredients.push(id);
  else filtrePrioriteIngredients.splice(index, 1);
}

function filtrerListePrioriteIngredients(texte) {
  const t = texte.toLowerCase();
  document.querySelectorAll('#liste-priorite-ingredients label').forEach(el => {
    el.style.display = el.dataset.nom.includes(t) ? 'flex' : 'none';
  });
}
// Ouvre le modal de validation de photo pour une recette : charge les candidates, ou en génère si aucune n'existe
async function ouvrirValidationPhoto(recetteId) {
  const recette = recettes.find(r => r.id === recetteId);
  if (!recette) return;

  let { data: candidatesRaw } = await db.from('recette_photos_candidates')
    .select('*').eq('recette_id', recetteId).eq('user_id', currentUser.id).order('ordre');

  // Reconstruire l'URL publique à partir du storage_path (non stocké en base)
  let candidates = (candidatesRaw || []).map(c => ({
    ...c,
    url: `${SUPABASE_URL}/storage/v1/object/public/photos-recettes/${c.storage_path}`
  }));


  const modal = document.createElement('div');
  modal.id = 'modal-validation-photo';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';

  if (!candidates || candidates.length === 0) {
    modal.innerHTML = `
      <div style="max-width:340px;width:100%;background:var(--bg-card);border-radius:16px;padding:24px;text-align:center">
        <div style="font-size:1rem;font-weight:700;margin-bottom:12px">📷 ${recette.nom}</div>
        <div class="loading-state" id="loading-candidates">Recherche de photos en cours…</div>
      </div>
    `;
    document.body.appendChild(modal);

    const response = await fetch('/api/photo-recette-candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recette_id: recetteId, nom: recette.nom, user_id: currentUser.id })
    });
    const result = await response.json();
    modal.remove();

    if (!result.success || result.candidates.length === 0) {
      alert('Aucune photo trouvée pour cette recette. Essaie une génération IA ou ajoute ta propre photo.');
      return;
    }
    candidates = result.candidates;
  }

  window._photoCandidateChoisie = null;
  afficherModalCandidates(recetteId, recette.nom, candidates);
}

function afficherModalCandidates(recetteId, nomRecette, candidates) {
  document.getElementById('modal-validation-photo')?.remove();
  const modal = document.createElement('div');
  modal.id = 'modal-validation-photo';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="max-width:400px;width:100%;background:var(--bg-card);border-radius:16px;padding:20px">
      <div style="font-size:1rem;font-weight:700;margin-bottom:14px">📷 ${nomRecette} — choisis la photo</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
        ${candidates.map(c => `
<div class="photo-candidate" data-url="${c.url}"
            style="border:2px solid var(--border);border-radius:8px;overflow:hidden;cursor:pointer;aspect-ratio:1"
            onclick="selectionnerCandidate(this, '${c.url}')">
            <img src="${c.url}" style="width:100%;height:100%;object-fit:cover" />
          </div>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-outline" style="flex:1" onclick="document.getElementById('modal-validation-photo').remove()">Annuler</button>
        <button class="btn-primary" style="flex:1" id="btn-confirmer-photo" disabled onclick="confirmerPhotoChoisie('${recetteId}')">✅ Valider</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function selectionnerCandidate(el, url) {
  document.querySelectorAll('.photo-candidate').forEach(c => c.style.borderColor = 'var(--border)');
  el.style.borderColor = 'var(--accent)';
  window._photoCandidateChoisie = url;
  document.getElementById('btn-confirmer-photo').disabled = false;
}

async function confirmerPhotoChoisie(recetteId) {
  const urlChoisie = window._photoCandidateChoisie;
  if (!urlChoisie) return;

  const response = await fetch('/api/valider-photo-recette', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recette_id: recetteId, url_choisie: urlChoisie, user_id: currentUser.id })
  });
  const result = await response.json();

  document.getElementById('modal-validation-photo')?.remove();

  if (result.success) {
    const recette = recettes.find(r => r.id === recetteId);
    if (recette) recette.photo_url = result.photo_url;
    // Recharger l'affichage des recettes pour retirer le badge 📷
    if (typeof renderRecettes === 'function') renderRecettes();
  } else {
    alert('Erreur lors de la validation : ' + (result.error || 'inconnue'));
  }
}
function changerSection(section) {
  sectionRecette = section;
  filtreBase = ''; filtreGout = ''; filtreDiff = '';
  renderRecettes();
}
 
// =============================================
// FICHE RECETTE — avec photo_url en en-tête
// =============================================
 
function ouvrirFicheRecette(id) {
  recetteOuverte = recettes.find(r => r.id === id);
  if (!recetteOuverte) return;
  renderFiche(1);
  afficherModal('modal-fiche-recette');
  // Si modal soirée ouvert, passer la fiche par-dessus
  const ficheEl = document.getElementById('modal-fiche-recette');
  if (ficheEl && document.getElementById('modal-tableau-bord-soiree')) {
    ficheEl.style.zIndex = '9500';
  }
}

// =============================================
// CALCUL BATCH
// =============================================

function getBatchInfo(r, p) {
  if (p < 4) return null;
  const ratio = p >= 7 ? 0.25 : 0.20;
  const totalSpiritueux = (r.ingredients || [])
    .filter(i => i.quantite && (i.unite === 'cl' || i.unite === 'ml') && !i.optionnel)
    .reduce((s, i) => {
      const qte = i.unite === 'ml' ? i.quantite / 10 : i.quantite;
      return s + (qte * p);
    }, 0);
  const eau = Math.round(totalSpiritueux * ratio * 10) / 10;
  const total = Math.round((totalSpiritueux + eau) * 10) / 10;
  return { totalSpiritueux: Math.round(totalSpiritueux * 10) / 10, eau, total, ratio: Math.round(ratio * 100) };
}

function getBatchConseils(r, portions) {
  const ings = (r.ingredients || []).map(i => i.nom.toLowerCase());
  const has = (...mots) => mots.some(m => ings.some(i => i.includes(m)));

  const frozen = has('glace pilée', 'blender', 'frozen');
  const cafe = has('café', 'espresso', 'expresso', 'cold brew');
  const oeuf = has('blanc d\'œuf', 'aquafaba', 'oeuf');
  const creme = has('crème', 'lait');
  const petillant = has('champagne', 'prosecco', 'eau gazeuse', 'tonic', 'ginger beer', 'ginger ale', 'cola', 'soda');
  const menthe = has('menthe');
  const agrumes = has('citron', 'pamplemousse', 'orange');
  const frais = has('framboise', 'fraise', 'ananas frais', 'pêche fraîche');

  if (frozen) {
    return `<div class="batch-planning">
      <div class="batch-planning-titre">⚠️ Batch impossible</div>
      <div class="batch-planning-texte">Ce cocktail nécessite un blender et de la glace pilée — préparation sur place uniquement. Prévoir blender + glace pilée à destination.</div>
    </div>`;
  }

  const jm1 = [];
  const jourJ = [];
  const deuxH = [];
  const service = [];
  const transport = [];

  // J-1
  jm1.push('Préparer le batch : spiritueux + sirops. Mettre en bouteille hermétique, étiqueter, réfrigérer.');
 const bitters = (r.ingredients || []).filter(i => i.unite === 'traits' || i.unite === 'trait');
if (bitters.length > 0) {
  const listeBitters = bitters.map(i => `${(i.quantite || 1) * portions} traits ${i.nom}`).join(', ');
  jm1.push(`Intégrer les bitters directement au batch : ${listeBitters}.`);
}
  if (agrumes) jm1.push('Presser les agrumes la veille si possible — conserver séparément au frais en bouteille fermée.');
  if (frais) jm1.push('Préparer les purées de fruits frais, filtrées et réfrigérées en bocal hermétique.');

  // Jour J départ
  jourJ.push('Sortir le batch du frigo 30 min avant départ si service à température ambiante.');
  if (petillant) jourJ.push('Mettre au frais les éléments pétillants (ne jamais les intégrer au batch).');
  if (menthe) jourJ.push('Cueillir ou emballer la menthe fraîche dans un linge humide — elle tient 6-8h.');
  if (oeuf) jourJ.push('Prévoir les blancs d\'œuf ou aquafaba en petit contenant séparé — ne jamais intégrer au batch.');
  if (creme) jourJ.push('Transporter crème/lait dans contenant isotherme séparé.');

  // Transport
  transport.push(`Batch (${portions} verres) en bouteille hermétique de ${Math.ceil(portions * 0.1)}L min, réfrigérée.`);
  if (cafe) transport.push('Café/espresso : thermos isotherme séparé — ne pas mélanger au batch avant destination.');
  if (petillant) transport.push('Éléments pétillants : bouteilles bien fermées, transportées debout et au frais.');
  if (oeuf) transport.push('Blancs d\'œuf : petit contenant hermétique au frais.');

  // 2h avant
  if (cafe) deuxH.push('Préparer les expressos frais et les intégrer au batch 1-2h avant service max.');
  if (agrumes) deuxH.push('Si jus non pressés la veille, presser maintenant et intégrer au batch.');
  if (creme) deuxH.push('Sortir crème/lait du frais 15 min avant service.');
  if (deuxH.length === 0) deuxH.push('Batch prêt — placer au frais jusqu\'au service.');

  // Au service
  service.push(`Shaker par tournées de 4 verres : ${Math.round(portions / 4 * 10) / 10} tournées prévues.`);
  if (oeuf) service.push('Blanc d\'œuf : dry shake sans glace 5 sec, puis shake avec glace 10 sec — verre par verre.');
  if (petillant) service.push('Verser l\'élément pétillant directement dans le verre après filtration — jamais dans le shaker.');
  if (menthe) service.push('Disposer la menthe fraîche en garniture au dernier moment.');

  const bloc = (titre, items, icon) => items.length === 0 ? '' : `
    <div class="batch-etape">
      <div class="batch-etape-titre">${icon} ${titre}</div>
      <ul class="batch-etape-liste">
        ${items.map(i => `<li>${i}</li>`).join('')}
      </ul>
    </div>`;

  return `
    <div class="batch-planning">
      <div class="batch-planning-titre">📋 Planning événement — ${portions} verres</div>
      ${bloc('J-1 — Préparation', jm1, '🗓️')}
      ${bloc('Jour J — Départ', jourJ, '🚗')}
      ${bloc('Transport', transport, '📦')}
      ${bloc('2h avant service', deuxH, '⏱️')}
      ${bloc('Au service', service, '🍸')}
    </div>`;
}

// =============================================
// RENDU FICHE PRINCIPALE
// =============================================
async function chargerJournalRecette(recetteId) {
 const { data, error } = await db
    .from('realisations')
    .select('*')
    .eq('recette_id', recetteId)
  .eq('user_id', currentUser.id)
    .order('date', { ascending: false });
  if (error || !data) return [];
  return data;
}
async function toggleJournalRecette() {
  const panneau = document.getElementById('panneau-journal');
  const overlay = document.getElementById('panneau-journal-overlay');
  document.getElementById('panneau-journal-nom').textContent = recetteOuverte.nom;
  panneau.classList.add('visible');
  overlay.classList.add('visible');
  document.getElementById('panneau-journal-body').innerHTML = '<div class="journal-vide">Chargement…</div>';
  const data = await chargerJournalRecette(recetteOuverte.id);
document.getElementById('panneau-journal-body').innerHTML = renderJournalRecette(data);
 document.getElementById('panneau-journal-body').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'editer') editerRealisation(btn.dataset.id);
  if (btn.dataset.action === 'annuler') annulerRealisation(btn.dataset.id, btn.dataset.recette, parseInt(btn.dataset.portions));
});
}

function fermerPanneauJournal() {
  document.getElementById('panneau-journal').classList.remove('visible');
  document.getElementById('panneau-journal-overlay').classList.remove('visible');
}
function renderJournalRecette(realisations) {
if (!realisations || realisations.length === 0) return `
    <div class="journal-vide">Aucune réalisation enregistrée.</div>`;
  return realisations.map(r => {
    let noteObj = {};
    try { noteObj = r.note ? JSON.parse(r.note) : {}; } catch(e) { noteObj = { note: r.note }; }
    const etoiles = noteObj.etoiles ? '★'.repeat(noteObj.etoiles) + '☆'.repeat(5 - noteObj.etoiles) : '';
    const details = [
      noteObj.plus ? `👍 ${noteObj.plus}` : null,
      noteObj.moins ? `👎 ${noteObj.moins}` : null,
      noteObj.note ? `💬 ${noteObj.note}` : null
    ].filter(Boolean).join(' · ');
    return `
    <div class="journal-ligne">
      <div class="journal-ligne-top">
        <span class="journal-date">${new Date(r.date).toLocaleDateString('fr-FR')}</span>
        <span class="journal-portions">${r.portions} verre${r.portions > 1 ? 's' : ''}</span>
        ${etoiles ? `<span class="journal-etoiles">${etoiles}</span>` : ''}
<div class="journal-actions">
  <button class="journal-btn" data-action="editer" data-id="${r.id}">✏️</button>
  <button class="journal-btn journal-btn--delete" data-action="annuler" data-id="${r.id}" data-recette="${recetteOuverte.id}" data-portions="${r.portions}">🗑️</button>
</div>
      </div>
      ${details ? `<div class="journal-details">${details}</div>` : ''}
      ${r.photo_url ? `<img src="${r.photo_url}" class="journal-photo">` : ''}
    </div>`;
  }).join('');
}
async function annulerRealisation(realisationId, recetteId, portions) {
  // Trouver la recette pour prévisualiser la re-incrémentation
  const r = recettes.find(rec => rec.id === recetteId);
  if (!r) return;

  // Construire le message de prévisualisation
  const preview = (r.ingredients || [])
    .filter(i => i.item_cave_id && i.quantite && i.unite)
    .map(i => `+${(i.quantite * portions).toFixed(1)} ${i.unite} de ${i.nom}`)
    .join('\n');

  const msg = preview
    ? `Cette annulation va remettre en cave :\n\n${preview}\n\nÊtes-vous sûr ?`
    : `Annuler cette réalisation de ${portions} verre${portions > 1 ? 's' : ''} ?\n\nÊtes-vous sûr ?`;

  if (!confirm(msg)) return;

  // Supprimer la réalisation
  await db.from('realisations').delete().eq('id', realisationId).eq('user_id', currentUser.id);

  // Re-incrémenter la cave
  for (const ing of (r.ingredients || [])) {
    if (!ing.item_cave_id || !ing.quantite || !ing.unite) continue;
    const itemCave = (cave?.categories || []).flatMap(c => c.items).find(i => i.id === ing.item_cave_id);
    if (!itemCave || itemCave.cl_restants === null) continue;
    const nouveau = Math.round((itemCave.cl_restants + ing.quantite * portions) * 10) / 10;
    await db.from('items').update({ cl_restants: nouveau }).eq('id', ing.item_cave_id).eq('user_id', currentUser.id);
    itemCave.cl_restants = nouveau;
  }

  // Recharger le journal
  const data = await chargerJournalRecette(recetteId);
const cible = document.getElementById('panneau-journal-body') || document.getElementById('journal-corps');
if (cible) cible.innerHTML = renderJournalRecette(data);
  renderCave();
}

async function editerRealisation(realisationId) {
  // Charger la réalisation existante
  const { data } = await db.from('realisations').select('*').eq('id', realisationId).single();
  if (!data) return;

  let noteObj = {};
  try { noteObj = data.note ? JSON.parse(data.note) : {}; } catch(e) {}

  const modal = document.getElementById('modal-realisation');
  modal.querySelector('#real-cocktail-nom').textContent = data.recette_nom;
  modal.querySelector('#real-date').value = data.date;
  modal.querySelector('#real-portions').value = data.portions;
  modal.querySelector('#real-plus').value = noteObj.plus || '';
  modal.querySelector('#real-moins').value = noteObj.moins || '';
  modal.querySelector('#real-note').value = noteObj.note || '';
  modal.querySelector('#real-photo-preview').innerHTML = data.photo_url
    ? `<img src="${data.photo_url}" style="max-width:100%;border-radius:8px;max-height:150px;object-fit:cover;">`
    : '';

  // Pré-remplir étoiles
  let etoilesVal = noteObj.etoiles || 0;
  const etoiles = modal.querySelectorAll('.etoile');
  etoiles.forEach(e => e.classList.toggle('active', parseInt(e.dataset.val) <= etoilesVal));
  etoiles.forEach(e => {
    e.onclick = () => {
      etoilesVal = parseInt(e.dataset.val);
      etoiles.forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= etoilesVal));
    };
  });

  // Preview photo
  modal.querySelector('#real-photo').onchange = function() {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      modal.querySelector('#real-photo-preview').innerHTML =
        `<img src="${e.target.result}" style="max-width:100%;border-radius:8px;max-height:150px;object-fit:cover;">`;
    };
    reader.readAsDataURL(file);
  };

  // Bouton confirmer = UPDATE (pas INSERT)
  modal.querySelector('#btn-confirmer-realisation').textContent = '✓ Mettre à jour';
  modal.querySelector('#btn-confirmer-realisation').onclick = async () => {
    const plus    = modal.querySelector('#real-plus').value.trim();
    const moins   = modal.querySelector('#real-moins').value.trim();
    const noteLib = modal.querySelector('#real-note').value.trim();
    const photoFile = modal.querySelector('#real-photo').files[0];

    const noteObj2 = {};
    if (etoilesVal) noteObj2.etoiles = etoilesVal;
    if (plus) noteObj2.plus = plus;
    if (moins) noteObj2.moins = moins;
    if (noteLib) noteObj2.note = noteLib;

    let photoUrl = data.photo_url;
    if (photoFile) {
      const ext = photoFile.name.split('.').pop();
      const path = `realisations/${currentUser.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await db.storage.from('photos-realisations').upload(path, photoFile, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = db.storage.from('photos-realisations').getPublicUrl(path);
        photoUrl = urlData?.publicUrl || null;
      }
    }

    await db.from('realisations').update({
      date: modal.querySelector('#real-date').value,
      portions: parseInt(modal.querySelector('#real-portions').value) || 1,
      note: Object.keys(noteObj2).length ? JSON.stringify(noteObj2) : null,
      photo_url: photoUrl
    }).eq('id', realisationId).eq('user_id', currentUser.id);

    fermerModal('modal-realisation');
    modal.querySelector('#btn-confirmer-realisation').textContent = '✓ Enregistrer';

    const journalData = await chargerJournalRecette(recetteOuverte.id);
const cible = document.getElementById('panneau-journal-body') || document.getElementById('journal-corps');
if (cible) cible.innerHTML = renderJournalRecette(journalData);
  };

  afficherModal('modal-realisation');
}
async function partagerRecette(id, nom) {
  const url = `${window.location.origin}/recette.html?id=${id}`;
  if (navigator.share) {
    try { await navigator.share({ title: nom, url }); }
    catch (e) { /* annulé par l'utilisateur */ }
  } else {
    await navigator.clipboard.writeText(url);
    alert('Lien copié ! ' + url);
  }
}
function getConseilBartender(r, p) {
  if (p === 1) return null;
  const nom = r.nom;
  if (p === 2) return {
    icon: '💡', titre: 'Pour 2 verres',
    texte: `Préparez les deux en une seule passe. Stirred : 30 tours puis filtrez les deux immédiatement. Shaké : shakez en une seule fois, filtrez vite. Un ${nom} attend mal — servez ensemble.`,
    bg: 'var(--bg-accent)', color: 'var(--text-accent)'
  };
  if (p <= 3) return {
    icon: '⚠️', titre: `Pour ${p} verres — 2 passes`,
    texte: `Divisez en 2 passes maximum. Ne préparez pas plus de 2 verres à la fois pour maintenir la qualité.`,
    bg: 'var(--bg-warning)', color: 'var(--text-warning)'
  };
  return {
    icon: '🚨', titre: `Pour ${p} verres — Mode batch`,
    texte: `Passez en mode batch. Préparez tout le ${nom} en une fois, servez immédiatement.`,
    bg: 'var(--bg-danger)', color: 'var(--text-danger)'
  };
}
function renderFiche(portions) {
  const r = recetteOuverte;
  const nbManquants = calculerDisponibilite(r);
  const caveIds = getItemsCave();
  const diffLabel = { facile: 'Facile', moyen: 'Moyen', avance: 'Avancé' }[r.difficulte] || r.difficulte;
  const ingsEffectifs = r._ajuste ? r._ajuste.ings : (r.ingredients || []);
  const estAjuste = !!r._ajuste;

  const conseil = getConseilBartender(r, portions);
  const batch   = getBatchInfo(r, portions);

  document.querySelector('.fiche-contenu').innerHTML = `

    <!-- EN-TÊTE -->
    <div class="fiche-entete">
${r.photo_url ? `<div class="fiche-img-wrap" style="${r.photo_cadrage ? 'position:relative;background:#000' : ''}"><img src="${r.photo_url}" alt="${r.nom}" class="${r.photo_cadrage ? '' : 'fiche-img'}" loading="lazy" ${r.photo_cadrage ? `style="position:absolute;top:50%;left:50%;width:100%;height:auto;max-width:none;transform:translate(calc(-50% + ${r.photo_cadrage.x}%), calc(-50% + ${r.photo_cadrage.y}%)) scale(${r.photo_cadrage.zoom});"` : ''} onerror="this.parentElement.style.display='none'"></div>` : ''}
<div class="fiche-entete-body">
        <div class="fiche-entete-top">
<input type="text" id="fiche-nom-input-${r.id}" value="${r.nom}" class="fiche-titre"
            style="font-family:inherit;background:none;border:none;border-bottom:1px dashed var(--border);color:inherit;width:100%;padding:2px 0"
            onblur="sauvegarderNomRecette('${r.id}', this.value)"
            onkeydown="if(event.key==='Enter') this.blur()">
          ${(() => {
            const vp = calculerVerresPossibles(r);
            if (!vp) return '';
            const couleur = vp.max === 0 ? 'var(--text-danger)' : vp.max <= 2 ? 'var(--text-warning)' : 'var(--text-success)';
            return `<div style="font-size:0.85rem;color:${couleur};font-weight:600;margin-top:4px">🍸 ${vp.max} verre${vp.max > 1 ? 's' : ''} possible${vp.max > 1 ? 's' : ''} avec ta cave actuelle${vp.partiel ? ' <span style="color:var(--text-muted);font-weight:400">(calcul partiel)</span>' : ''}</div>`;
          })()}
          <div class="fiche-badges">
            <span class="carte-diff diff-${r.difficulte}">${diffLabel}</span>
            ${badgeDisponibilite(nbManquants)}
            ${r.kit_portable ? '<span class="tag-kit">✓ KIT</span>' : ''}
            ${r.source_marque ? `<span style="background:var(--bg-accent);color:var(--text-accent);border:1px solid var(--border-accent);border-radius:20px;font-size:0.72rem;padding:3px 8px;">🏷️ ${r.source_marque}</span>` : ''}
          </div>
        </div>
        ${r.base_alcool ? `<div class="fiche-base">🥃 ${r.base_alcool}</div>` : ''}
      <div class="fiche-gouts">${(r.gouts || []).map(g => `<span class="tag-gout">${g}</span>`).join('')}</div>
        <button class="btn-outline" style="margin-top:8px;padding:6px 12px;font-size:0.78rem" onclick="partagerRecette('${r.id}', '${r.nom.replace(/'/g, "\\'")}')">🔗 Partager</button>
        ${estAjuste ? `
        <div class="fiche-bandeau-ajuste">
          <span>✦ Version ajustée active</span>
          <button class="fiche-bandeau-reset" onclick="annulerAjustements()">↺ Recette originale</button>
        </div>` : ''}
${r.illustration_url ? `
        <div style="display:flex;gap:12px;align-items:flex-start;margin:14px 0;padding:12px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">
          <div style="flex-shrink:0;width:88px">
            <img src="${r.illustration_url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;border:3px solid var(--bg-card);box-shadow:0 2px 6px rgba(0,0,0,0.3);filter:sepia(0.35) contrast(1.05)">
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.68rem;letter-spacing:0.5px;color:var(--text-accent);text-transform:uppercase;margin-bottom:3px">📜 Archive historique</div>
            ${r.illustration_credit ? `<div style="font-size:0.72rem;color:var(--text-muted);font-style:italic;line-height:1.35">${r.illustration_credit}</div>` : ''}
          </div>
        </div>` : ''}
        ${r.description_courte ? `<p class="fiche-description">${r.description_courte}</p>` : ''}
      </div>
    </div>

    <!-- SÉLECTEUR PORTIONS -->
    <div class="fiche-portions-bloc">
      <div class="portions-label-row">
        <span class="portions-label">Portions</span>
        ${r.prix_portion ? `<span class="fiche-prix-total">~${(r.prix_portion * portions).toFixed(2)}€ pour ${portions} verre${portions > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="portions-ctrl">
        <button class="portions-btn" onclick="renderFiche(${portions - 1})" ${portions <= 1 ? 'disabled' : ''}>−</button>
        <span class="portions-val">${portions}</span>
        <button class="portions-btn" onclick="renderFiche(${portions + 1})" ${portions >= 10 ? 'disabled' : ''}>+</button>
      </div>
    </div>

    <!-- CONSEIL BARTENDER -->
    ${conseil ? `
    <div class="fiche-conseil" style="background:${conseil.bg};color:${conseil.color}">
      <div class="fiche-conseil-titre">${conseil.icon} ${conseil.titre}</div>
      <div class="fiche-conseil-texte">${conseil.texte}</div>
    </div>` : ''}



    <!-- PROFIL GUSTATIF -->
    ${hasProfil(r) ? `
    <div class="fiche-card">
      <div class="fiche-card-header">
  <div class="fiche-card-titre">Profil gustatif</div>
  <button class="btn-ajuster-flottant" onclick="ouvrirPanneauAjustement('${r.id}')">✦ Ajuster</button>
</div>
      <div class="fiche-profil-grid">
        <div>
          ${renderBarre('Sucré',   r.gout_sucre)}
          ${renderBarre('Amer',    r.gout_amer)}
          ${renderBarre('Acide',   r.gout_acide)}
          ${renderBarre('Fruité',  r.gout_fruite)}
        </div>
        <div>
          ${renderBarre('Fumé',    r.gout_fume)}
          ${renderBarre('Floral',  r.gout_floral)}
          ${renderBarre('Épicé',   r.gout_epice)}
          ${renderBarre('Crémeux', r.gout_cremeux)}
        </div>
      </div>
    </div>` : ''}

    <!-- INGRÉDIENTS -->
    <div class="fiche-card">
      <div class="fiche-card-titre">Ingrédients <span class="fiche-portion-label">— ${portions} verre${portions > 1 ? 's' : ''}</span></div>
      <div class="fiche-ing-liste">
${ingsEffectifs.map(ing => {
          const enCave = ing.item_cave_id ? caveIds.has(ing.item_cave_id) : null; // null = non lié à Ma Cave, statut inconnu
const qteBase = ing.cl_ajuste !== undefined ? ing.cl_ajuste : ing.quantite;
const qteConverti = (ing.unite === 'ml' && qteBase) ? qteBase / 10 : qteBase;
const qte = qteConverti ? Math.round(qteConverti * portions * 10) / 10 : null;
const uniteAffichee = (ing.unite === 'ml') ? 'cl' : (ing.unite || '');
          const qteModif = ing.cl_ajuste !== undefined && Math.abs((ing.cl_ajuste || 0) - (ing.quantite || 0)) > 0.05;
          const pct = ing.quantite && r.ingredients.reduce((s, i) => s + (i.quantite || 0), 0) > 0
            ? Math.round((ing.quantite / r.ingredients.reduce((s, i) => s + (i.quantite || 0), 0)) * 100)
            : 0;
          const couleur = enCave === false ? 'danger' : (enCave === null ? 'muted' : (ing.optionnel ? 'success' : (qteModif ? 'warning' : 'accent')));
          return `
            <div class="fiche-ing-item">
              <div class="fiche-ing-icon fiche-ing-icon--${couleur}">
                <i class="ti ti-droplet" aria-hidden="true"></i>
              </div>
              <div class="fiche-ing-body">
                <div class="fiche-ing-header">
                  <span class="fiche-ing-nom ${enCave === false && !ing.optionnel ? 'fiche-ing-nom--manquant' : ''}">${ing.nom}${ing.optionnel ? ' <span class="fiche-ing-opt">optionnel</span>' : ''}</span>
                  <span class="fiche-ing-qte">${qte ? qte + ' ' + uniteAffichee : ''}</span>
                </div>
                ${pct > 0 ? `<div class="fiche-ing-barre"><div class="fiche-ing-barre-fill fiche-ing-barre-fill--${couleur}" style="width:${pct}%"></div></div>` : ''}
                ${enCave === false && !ing.optionnel ? `<div class="fiche-ing-warn">Manquant — voir À acheter</div>` : ''}
${enCave === null && !ing.optionnel && !/glace|glaçon/i.test(ing.nom || '') ? `
  <div style="display:flex;align-items:center;gap:8px;">
    <div class="fiche-ing-warn" style="color:var(--text-muted)">Non lié à Ma Cave</div>
    <button onclick="event.stopPropagation();ouvrirLiaisonIngredient('${ing.nom.replace(/'/g, "\\'")}', '${ing.id}')" 
      style="background:none;border:1px solid var(--border);border-radius:6px;padding:2px 8px;font-size:0.75rem;color:var(--text-accent);cursor:pointer;">
      🔗 Lier
    </button>
  </div>` : ''}
  </div>
            </div>`;
        }).join('')}
      </div>
${batch ? `
<div class="fiche-batch-wrap">
  <div class="fiche-batch-info">
    <strong>Batch ${portions} verres :</strong> 
${(r.ingredients || []).filter(i => i.quantite && (i.unite === 'cl' || i.unite === 'ml') && !i.optionnel).map(i => {
  const qte = i.unite === 'ml' ? Math.round(i.quantite * portions / 10 * 10) / 10 : Math.round(i.quantite * portions * 10) / 10;
  return `${qte}cl ${i.nom}`;
}).join(' + ')}    ${(r.ingredients || []).filter(i => i.unite === 'traits' || i.unite === 'trait').map(i => ` + ${(i.quantite || 1) * portions} traits ${i.nom}`).join('')}
= <strong>${batch.total}cl</strong> — <span style="opacity:0.7;font-size:0.85rem">avec dilution au service (shake ou mélanger/stirred) · ou ${batch.totalAvecEau}cl avec +20% eau si service direct sans dilution</span>  </div>
  ${getBatchConseils(r, portions)}
</div>` : ''}
    </div>

    <!-- MATÉRIELS -->
${r.materiels && r.materiels.length > 0 ? `
<div class="fiche-card">
  <div class="fiche-card-titre">Matériels</div>
  <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">
    ${r.materiels.map(m => {
      const icones = {
        'shaker': '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M9 4h10M9 4v6h10V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 10l1 14h8l1-14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><line x1="9" y1="14" x2="19" y2="14" stroke="currentColor" stroke-width="0.8" stroke-dasharray="1.5 1.5"/></svg>',
        'verre à mélange': '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M8 4h12M8 4v18q0 3 6 3t6-3V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><line x1="8" y1="11" x2="20" y2="11" stroke="currentColor" stroke-width="0.8" stroke-dasharray="1.5 1.5"/><line x1="20" y1="15" x2="24" y2="15" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
        'verre old fashioned': '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 6h16L19 22H9L6 6z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><line x1="6" y1="6" x2="22" y2="6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
        'verre à martini': '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M5 6l9 10 9-10H5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><line x1="14" y1="16" x2="14" y2="24" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="10" y1="24" x2="18" y2="24" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
        'coupette': '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M5 7 Q14 18 23 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/><line x1="5" y1="7" x2="23" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="14" y1="17" x2="14" y2="24" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="10" y1="24" x2="18" y2="24" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
        'highball': '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M9 4h10v20H9z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><line x1="9" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="0.8" stroke-dasharray="1.5 1.5"/></svg>',
        'passoire julep': '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 12 Q4 21 14 21 Q24 21 24 12Z" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="4" y1="12" x2="24" y2="12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="14" y1="21" x2="14" y2="26" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="10" cy="16" r="1" fill="currentColor"/><circle cx="14" cy="17.5" r="1" fill="currentColor"/><circle cx="18" cy="16" r="1" fill="currentColor"/></svg>',
        'passoire fine': '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 12 Q4 21 14 21 Q24 21 24 12Z" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="4" y1="12" x2="24" y2="12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="14" y1="21" x2="14" y2="26" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="9" cy="15" r="0.7" fill="currentColor"/><circle cx="12" cy="17" r="0.7" fill="currentColor"/><circle cx="15" cy="17.5" r="0.7" fill="currentColor"/><circle cx="18" cy="17" r="0.7" fill="currentColor"/><circle cx="21" cy="15" r="0.7" fill="currentColor"/></svg>',
        'cuillère de bar': '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><line x1="14" y1="25" x2="14" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><ellipse cx="14" cy="10" rx="3.5" ry="2.5" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="14" y1="7.5" x2="14" y2="4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
        'jigger': '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M10 14h8M10 14l-2-8h12l-2 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 14l-1 6h10l-1-6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        'pilon': '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="11" y="4" width="6" height="14" rx="3" stroke="currentColor" stroke-width="1.2"/><ellipse cx="14" cy="20" rx="5" ry="3" stroke="currentColor" stroke-width="1.2"/></svg>',
        'blender': '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M9 6h10l-2 14H11L9 6z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><line x1="9" y1="6" x2="19" y2="6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><rect x="10" y="20" width="8" height="4" rx="1" stroke="currentColor" stroke-width="1.2"/></svg>',
      };
      const key = m.nom.toLowerCase();
      const svg = Object.entries(icones).find(([k]) => key.includes(k))?.[1] 
        || '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="8" stroke="currentColor" stroke-width="1.2"/><line x1="14" y1="10" x2="14" y2="14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="14" cy="17" r="1" fill="currentColor"/></svg>';
      const desc = {
        'shaker': 'Shake vigoureusement avec glace',
        'verre à mélange': 'Pour stirrer sans diluer trop vite',
        'verre old fashioned': 'Service sur glaçon unique',
        'verre à martini': 'Service sans glace, bien froid',
        'coupette': 'Service sans glace, élégant',
        'highball': 'Grand verre pour long drinks',
        'passoire julep': 'Filtration depuis le verre à mélange',
        'passoire fine': 'Double filtration pour un résultat limpide',
        'cuillère de bar': 'Stirrer 30–45 secondes',
        'jigger': 'Mesure précise des doses',
        'pilon': 'Écraser herbes et agrumes délicatement',
        'blender': 'Cocktails frozen, glace pilée',
      };
      const description = Object.entries(desc).find(([k]) => key.includes(k))?.[1] || '';
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary)">
          <div style="flex-shrink:0;opacity:0.7">${svg}</div>
          <div>
            <div style="font-size:0.85rem;font-weight:600">${m.nom}${!m.essentiel ? ' <span style="font-size:0.72rem;color:var(--text-muted);font-weight:400">optionnel</span>' : ''}</div>
            ${description ? `<div style="font-size:0.75rem;color:var(--text-secondary)">${description}</div>` : ''}
          </div>
        </div>`;
    }).join('')}
  </div>
</div>` : ''}

    <!-- PRÉPARATION -->
    <div class="fiche-card">
      <div class="fiche-card-titre">Préparation${portions > 1 ? ` — ${portions} verres` : ''}</div>
      <div class="fiche-etapes-timeline">
        ${(r.etapes || []).map((e, i) => `
          <div class="fiche-etape-row">
            <div class="fiche-etape-left">
              <div class="fiche-etape-num ${i === (r.etapes.length - 1) ? 'fiche-etape-num--done' : ''}">
                ${i === (r.etapes.length - 1) ? '<i class="ti ti-check" aria-hidden="true"></i>' : i + 1}
              </div>
              ${i < (r.etapes.length - 1) ? '<div class="fiche-etape-line"></div>' : ''}
            </div>
            <div class="fiche-etape-body">
              <div class="fiche-etape-titre">${e.titre}</div>
              <div class="fiche-etape-desc">${e.description}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- DÉGUSTATION -->
    ${r.degustation_voir ? `
    <div class="fiche-card">
      <div class="fiche-card-titre">Guide de dégustation</div>
      <div class="fiche-degu-steps">
        <div class="fiche-degu-step"><span class="fiche-degu-icon">👁</span><div><div class="fiche-degu-label">Regardez</div><div class="fiche-degu-texte">${r.degustation_voir}</div></div></div>
        <div class="fiche-degu-step"><span class="fiche-degu-icon">👃</span><div><div class="fiche-degu-label">Sentez</div><div class="fiche-degu-texte">${r.degustation_sentir}</div></div></div>
        <div class="fiche-degu-step"><span class="fiche-degu-icon">👅</span><div><div class="fiche-degu-label">Goûtez</div><div class="fiche-degu-texte">${r.degustation_gout}</div></div></div>
        <div class="fiche-degu-step"><span class="fiche-degu-icon">✨</span><div><div class="fiche-degu-label">Finish</div><div class="fiche-degu-texte">${r.degustation_finish}</div></div></div>
        ${r.degustation_defi ? `<div class="fiche-degu-step fiche-degu-step--defi"><span class="fiche-degu-icon">🎯</span><div><div class="fiche-degu-label">Défi détection</div><div class="fiche-degu-texte">${r.degustation_defi}</div></div></div>` : ''}
      </div>
    </div>` : ''}

    <!-- VARIANTES -->
    ${hasVariantes(r) || r.variante_cave ? `
    <div class="fiche-card">
      <div class="fiche-card-titre">Variantes et alternatives</div>
      ${r.variante_cave ? `
      <div class="fiche-variante fiche-variante--cave">
        <div class="fiche-variante-label">Avec votre cave</div>
        <div class="fiche-variante-nom">${r.variante_cave_nom || 'Variante maison'}</div>
        <div class="fiche-variante-desc">${r.variante_cave}</div>
      </div>` : ''}
      ${r.variante_alcool ? `
      <div class="fiche-variante">
        <div class="fiche-variante-label">Autre alcool</div>
        <div class="fiche-variante-desc">${r.variante_alcool}</div>
      </div>` : ''}
      ${r.variante_prestige ? `
      <div class="fiche-variante fiche-variante--prestige">
        <div class="fiche-variante-label">Version prestige</div>
        <div class="fiche-variante-desc">${r.variante_prestige}</div>
      </div>` : ''}
     <div class="fiche-variante">
  <div class="fiche-variante-label">Mocktail associé</div>
  ${r.variante_mocktail_id ? `
  <button class="btn-variante-link" onclick="fermerModal('modal-fiche-recette'); setTimeout(()=>{ changerSection('mocktail'); ouvrirFicheRecette('${r.variante_mocktail_id}'); }, 200)">
    Voir ${recettes.find(x=>x.id===r.variante_mocktail_id)?.nom || r.variante_mocktail_id} →
  </button>` : `
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <span style="font-size:13px;color:var(--text-muted);">Pas de mocktail dédié</span>
    <button class="btn-variante-link" onclick="fermerModal('modal-fiche-recette'); setTimeout(()=>{ changerSection('mocktail'); }, 200)">
      Explorer les mocktails →
    </button>
  </div>`}
</div>
      ${r.variante_notes ? `
      <div class="fiche-variante">
        <div class="fiche-variante-label">Notes</div>
        <div class="fiche-variante-desc">${r.variante_notes}</div>
      </div>` : ''}
    </div>` : ''}

   

    <!-- ANECDOTE -->
    ${r.anecdote ? `
    <div class="fiche-card fiche-card--anecdote">
      <div class="fiche-card-titre">Histoire</div>
      <p class="fiche-anecdote-texte">${r.anecdote}</p>
    </div>` : ''}
    
<!-- JOURNAL -->
    <div class="journal-bloc">
      <div class="journal-header" onclick="toggleJournalRecette()">
        <span>🗒 Journal</span>
        <span id="journal-chevron">▸</span>
      </div>
      <div id="journal-corps"></div>
    </div>
<!-- ACTION RÉALISÉE -->
    <div class="fiche-action">
     <button class="btn btn-realiser" onclick="ouvrirModalRealisation(${portions})">
        ✓ Réalisée${portions > 1 ? ` (${portions} verres)` : ''} — décrémenter la cave
      </button>
    </div>

    <!-- ACTION SUPPRIMER -->
    <div class="fiche-action" style="margin-top:10px">
      <button class="btn-danger" style="width:100%" onclick="supprimerRecette('${r.id}')">
        🗑️ Supprimer cette recette
      </button>
    </div>
  `;
}

async function sauvegarderNomRecette(id, nouveauNom) {
  const nom = (nouveauNom || '').trim();
  const r = recettes.find(x => x.id === id);
  if (!r || !nom || nom === r.nom) return;
  await db.from('recettes').update({ nom }).eq('id', id).eq('user_id', currentUser.id);
  r.nom = nom;
  renderRecettes();
}
async function supprimerRecette(id) {
  const r = recettes.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`Supprimer définitivement "${r.nom}" ? Cette action est irréversible.`)) return;

  await db.from('recette_ingredients').delete().eq('recette_id', id);
  await db.from('recette_etapes').delete().eq('recette_id', id);

  const { error } = await db.from('recettes').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      alert('Impossible de supprimer : cette recette est liée à une ou plusieurs réalisations enregistrées. Supprime d\'abord ces réalisations dans le journal, ou demande le nettoyage SQL correspondant.');
    } else {
      alert('Erreur suppression : ' + error.message);
    }
    return;
  }

  // Si cette recette provenait d'une inspiration validée, elle redevient "validable"
  await db.from('inspirations').update({ statut: 'en_attente', recette_liee_id: null }).eq('recette_liee_id', id);
  const inspiLiee = inspirationsList.find(i => i.recette_liee_id === id);
  if (inspiLiee) {
    inspiLiee.statut = 'en_attente';
    inspiLiee.recette_liee_id = null;
    renderInspirations();
  }

  recettes = recettes.filter(x => x.id !== id);
  fermerModal('modal-fiche-recette');
  renderRecettes();
}
 
function hasProfil(r) {
  return r.gout_sucre || r.gout_amer || r.gout_acide || r.gout_fruite ||
         r.gout_fume  || r.gout_floral || r.gout_epice || r.gout_cremeux;
}
 
function hasVariantes(r) {
  return r.variante_alcool || r.variante_prestige || r.variante_mocktail_id || r.variante_notes;
}
 
function renderBarre(label, valeur) {
  if (!valeur) return '';
  const pct = Math.round((valeur / 5) * 100);
  const couleur = valeur >= 4 ? 'var(--accent)' : valeur >= 2 ? 'var(--accent-light)' : 'var(--text-muted)';
  return `
    <div class="barre-row">
      <span class="barre-label">${label}</span>
      <div class="barre-track">
        <div class="barre-fill" style="width:${pct}%; background:${couleur}"></div>
      </div>
      <span class="barre-val">${valeur}/5</span>
    </div>
  `;
}
 async function decrementerBouteillesVoyage(recette, portions) {
  const updatesVoyage = [];
  for (const ing of (recette.ingredients || [])) {
    if (!ing.item_cave_id || !ing.quantite || !ing.unite) continue;
    if (ing.unite !== 'cl') continue;
    const bouteille = voyageBouteillesActives.find(b => b.item_cave_id === ing.item_cave_id);
    if (bouteille && bouteille.cl_restants_voyage !== null) {
      const nouveau = Math.max(0, bouteille.cl_restants_voyage - (ing.quantite * portions));
      updatesVoyage.push({ bouteille, nouveau });
    }
  }
  for (const { bouteille, nouveau } of updatesVoyage) {
    await db.from('mode_voyage_bouteilles').update({ cl_restants_voyage: nouveau }).eq('id', bouteille.id);
    bouteille.cl_restants_voyage = nouveau;
  }
  return updatesVoyage.length;
}
async function marquerRealisee(portions) {
  const r = recetteOuverte;
  const caveIds = getItemsCave();

  const updates = [];
  const updatesVoyage = [];

  for (const ing of (r.ingredients || [])) {
    if (!ing.item_cave_id || !ing.quantite || !ing.unite) continue;
    if (ing.unite !== 'cl') continue;

    if (voyageActif) {
      const bouteille = voyageBouteillesActives.find(b => b.item_cave_id === ing.item_cave_id);
      if (bouteille && bouteille.cl_restants_voyage !== null) {
        const nouveau = Math.max(0, bouteille.cl_restants_voyage - (ing.quantite * portions));
        updatesVoyage.push({ bouteille, nouveau });
      }
      continue;
    }

    if (!caveIds.has(ing.item_cave_id)) continue;
    for (const cat of cave.categories) {
      const item = cat.items.find(i => i.id === ing.item_cave_id);
      if (item && item.cl_restants !== null) {
        const nouveau = Math.max(0, item.cl_restants - (ing.quantite * portions));
        updates.push({ item, nouveau });
      }
    }
  }

  for (const { item, nouveau } of updates) {
    await db.from('items').update({ cl_restants: nouveau }).eq('id', item.id).eq('user_id', currentUser.id);
    item.cl_restants = nouveau;
  }

  for (const { bouteille, nouveau } of updatesVoyage) {
    await db.from('mode_voyage_bouteilles').update({ cl_restants_voyage: nouveau }).eq('id', bouteille.id);
    bouteille.cl_restants_voyage = nouveau;
  }

  fermerModal('modal-fiche-recette');

  const nbTouches = updates.length + updatesVoyage.length;
  const feedback = document.createElement('div');
  feedback.className = 'toast-feedback';
  feedback.textContent = voyageActif
    ? `✓ Cave voyage mise à jour (${updatesVoyage.length} bouteille${updatesVoyage.length > 1 ? 's' : ''})`
    : nbTouches > 0
      ? `✓ Cave mise à jour (${nbTouches} bouteille${nbTouches > 1 ? 's' : ''} décrémentée${nbTouches > 1 ? 's' : ''})`
      : '✓ Recette marquée comme réalisée';
  document.body.appendChild(feedback);
  setTimeout(() => feedback.classList.add('visible'), 50);
  setTimeout(() => { feedback.classList.remove('visible'); setTimeout(() => feedback.remove(), 300); }, 2500);

  if (!voyageActif) renderCave();
}
 
// =============================================
// MODALS CAVE
// =============================================
 
function ouvrirModalItem(itemId, catId) {
  const item = trouverItem(itemId, catId);
  if (!item) return;
  const categoriesExclues = ['ingredients-frais', 'garde-manger', 'ponctuels'];
  if (categoriesExclues.includes(catId)) return;
 
  document.getElementById('modal-ouverture-titre').textContent = item.nom;
  document.getElementById('modal-ouverture-texte').textContent = item.ouvert
    ? 'Cette bouteille est déjà marquée comme ouverte. Voulez-vous la refermer ?'
    : `Confirmer l'ouverture de ${item.nom} ?`;
 
  const conservationDiv = document.getElementById('modal-conservation-info');
  if (!item.ouvert && item.conservation) {
    conservationDiv.innerHTML = `
      <strong>⚠️ Conservation requise</strong>
      ${item.conservation.conditions}<br>
      <em>Signes d'altération : ${item.conservation.signes_alteration}</em>
    `;
    conservationDiv.style.display = 'block';
  } else {
    conservationDiv.style.display = 'none';
  }
 
  document.getElementById('btn-confirmer-ouverture').onclick = async () => {
    const nouvelEtat = !item.ouvert;
    const updates    = { ouvert: nouvelEtat, date_ouverture: nouvelEtat ? new Date().toISOString() : null };
    await db.from('items').update(updates).eq('id', itemId).eq('user_id', currentUser.id);
    item.ouvert = nouvelEtat;
    item.date_ouverture = updates.date_ouverture;
    fermerModal('modal-ouverture');
    renderCave();
  };
 
  afficherModal('modal-ouverture');
}
 
function ouvrirModalContenance(itemId, catId) {
  const item = trouverItem(itemId, catId);
  if (!item) return;
  const categoriesExclues = ['ingredients-frais', 'garde-manger', 'ponctuels'];
  if (categoriesExclues.includes(catId)) return;
 
  document.getElementById('modal-contenance-titre').textContent = item.nom;
  const body = document.querySelector('.modal-contenance-body');
 
  body.innerHTML = `
    <div class="form-group">
      <label>Contenance totale (cl)</label>
      <div class="contenance-presets">
        ${[20, 35, 50, 70, 100].map(v => `
          <button class="preset-btn ${item.cl_total === v ? 'active' : ''}"
            onclick="setCl('cl-total', ${v})">${v}cl</button>
        `).join('')}
        <input type="number" id="input-cl-total" placeholder="autre" value="${item.cl_total ?? ''}"
          oninput="syncNiveau()">
      </div>
    </div>
 
    <div class="form-group">
      <label>Niveau actuel</label>
      <div class="niveau-btns">
        <button class="niveau-btn" onclick="setNiveau(1)">Plein</button>
        <button class="niveau-btn" onclick="setNiveau(0.75)">¾</button>
        <button class="niveau-btn" onclick="setNiveau(0.5)">½</button>
        <button class="niveau-btn" onclick="setNiveau(0.25)">¼</button>
        <button class="niveau-btn" onclick="setNiveau(0)">Vide</button>
      </div>
      <div class="form-row" style="margin-top:10px">
        <div class="form-group" style="margin:0">
          <label>ou cl restants exacts</label>
          <input type="number" id="input-cl-restants" placeholder="ex: 45"
            value="${item.cl_restants ?? ''}" oninput="syncNiveau()">
        </div>
      </div>
    </div>
  `;
 
document.getElementById('btn-sauver-contenance').onclick = async () => {
    const totalInput = document.getElementById('input-cl-total')?.value;
    const restantsInput = document.getElementById('input-cl-restants')?.value;
    const cl_total = totalInput !== '' && !isNaN(parseInt(totalInput)) ? parseInt(totalInput) : item.cl_total;
    const restantsNormalise = (restantsInput || '').replace(',', '.');
    const cl_restants = restantsNormalise !== '' && !isNaN(parseFloat(restantsNormalise)) ? parseFloat(restantsNormalise) : item.cl_restants;
    const updates = { cl_total, cl_restants };
    const { error } = await db.from('items').update(updates).eq('id', itemId).eq('user_id', currentUser.id);
    if (error) {
      alert('❌ Erreur de sauvegarde : ' + error.message);
      return;
    }
    Object.assign(item, updates);
    fermerModal('modal-contenance');
    renderCave();
  };
 
  afficherModal('modal-contenance');
}
 
function setCl(fieldId, val) {
  const input = document.getElementById('input-' + fieldId.replace('-', '-'));
  if (input) { input.value = val; syncNiveau(); }
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}
 
function setNiveau(ratio) {
  const total = parseFloat(document.getElementById('input-cl-total')?.value);
  const inputR = document.getElementById('input-cl-restants');
  if (total && inputR) inputR.value = Math.round(total * ratio * 10) / 10;
  document.querySelectorAll('.niveau-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}
 
function syncNiveau() {
  document.querySelectorAll('.niveau-btn').forEach(b => b.classList.remove('active'));
}
 
function ouvrirModalInfo(itemId, catId) {
  const item = trouverItem(itemId, catId);
  if (!item) return;
 
  document.getElementById('modal-info-titre').textContent = item.nom;
 
  const corps = document.getElementById('modal-info-corps');
  if (item.info_description || item.info_origine || item.info_anecdote) {
    corps.innerHTML = `
      ${item.info_description ? `
        <div class="info-bloc">
          <div class="info-bloc-titre">📋 Description</div>
          <p>${item.info_description}</p>
        </div>` : ''}
      ${item.info_origine ? `
        <div class="info-bloc">
          <div class="info-bloc-titre">🌍 Origine</div>
          <p>${item.info_origine}</p>
        </div>` : ''}
      ${item.info_anecdote ? `
        <div class="info-bloc info-bloc-anecdote">
          <div class="info-bloc-titre">💬 Anecdote</div>
          <p>${item.info_anecdote}</p>
        </div>` : ''}
    `;
  } else {
    corps.innerHTML = `<p class="info-vide">${item.detail || 'Aucune information disponible.'}</p>`;
  }
 
  afficherModal('modal-info');
}
 
function ouvrirModalAjout() {
  const modal = document.getElementById('modal-ajout');
 
  const select = document.getElementById('select-categorie-ajout');
  select.innerHTML = cave.categories
    .filter(c => !c.id.startsWith('a-acheter') && !c.id.startsWith('ingredients'))
    .map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`)
    .join('');
 
  modal.querySelector('#input-nom-ajout').value         = '';
  modal.querySelector('#input-detail-ajout').value      = '';
  modal.querySelector('#input-degre-ajout').value       = '';
  modal.querySelector('#input-prix-paye-ajout').value   = '';
  modal.querySelector('#input-cl-ajout').value          = '';
  modal.querySelector('#input-origine-ajout').value     = '';
  modal.querySelector('#input-anecdote-ajout').value    = '';
  modal.querySelector('#ajout-claude-result').innerHTML = '';
  modal.querySelector('#ajout-claude-result').classList.remove('visible');
 
  modal.querySelector('#btn-identifier-claude').onclick = async () => {
    const nom = modal.querySelector('#input-nom-ajout').value.trim();
    if (!nom) { alert("Saisissez d'abord le nom du produit."); return; }
 
    const btn = modal.querySelector('#btn-identifier-claude');
    btn.disabled = true;
    btn.textContent = '⏳ Identification…';
   window._sousTypeIdentifie = null;
    window._tourbeIdentifie = false;
 
    const result = modal.querySelector('#ajout-claude-result');
    result.innerHTML = '';
 
    try {
      const response = await fetch('/api/identifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom })
      });
      const info = await response.json();
 
      if (info.trop_vague) {
        result.innerHTML = '<div class="ajout-claude-warning">⚠️ Nom trop vague — précisez la marque complète.</div>';
        result.classList.add('visible');
      } else if (!info.identifie) {
        result.innerHTML = '<div class="ajout-claude-warning">❓ Produit non identifié — remplissez les champs manuellement.</div>';
        result.classList.add('visible');
      } else {
        if (info.categorie_id) select.value = info.categorie_id;
        if (info.degre) modal.querySelector('#input-degre-ajout').value = info.degre;
        if (info.description) modal.querySelector('#input-detail-ajout').value = info.description;
        if (info.origine) modal.querySelector('#input-origine-ajout').value = info.origine;
        if (info.anecdote) modal.querySelector('#input-anecdote-ajout').value = info.anecdote;
       window._sousTypeIdentifie = info.sous_type_alcool || null;
        window._tourbeIdentifie = !!info.tourbe;
 
        result.innerHTML = `<div class="ajout-claude-success">✅ Identifié — champs pré-remplis, vérifiez et complétez.</div>`;
        result.classList.add('visible');
      }
    } catch(e) {
      result.innerHTML = "<div class='ajout-claude-warning'>Erreur d'identification. Remplissez manuellement.</div>";
      result.classList.add('visible');
    }
 
    btn.disabled = false;
    btn.textContent = '✨ Identifier avec Claude';
  };
 
  modal.querySelector('#btn-confirmer-ajout').onclick = async () => {
    const catId   = select.value;
    const nom     = modal.querySelector('#input-nom-ajout').value.trim();
    const detail  = modal.querySelector('#input-detail-ajout').value.trim();
    const degre   = parseFloat(modal.querySelector('#input-degre-ajout').value) || null;
    const prixPaye = parseFloat(modal.querySelector('#input-prix-paye-ajout').value) || null;
    const cl_total = parseInt(modal.querySelector('#input-cl-ajout').value) || null;
    const origine  = modal.querySelector('#input-origine-ajout').value.trim();
    const anecdote = modal.querySelector('#input-anecdote-ajout').value.trim();
 if (!nom) return;

    const newItem = {
      id:               'custom-' + Date.now(),
      user_id:          currentUser.id,
      category_id:      catId,
      nom, detail,
      degre,
      sous_type_alcool: window._sousTypeIdentifie || null,
      tourbe:           window._tourbeIdentifie || false,
      prix_estime:      prixPaye,
      cl_total,
      cl_restants:      cl_total,
      ouvert:           false,
      detenu:           true,
      conservation:     null,
      info_description: detail || null,
      info_origine:     origine || null,
      info_anecdote:    anecdote || null
    };

const { data, error } = await db.from('items').insert(newItem).select().single();
    if (error) {
      alert('Erreur lors de l\'ajout : ' + error.message);
      return;
    }
    if (data) {
      window._sousTypeIdentifie = null;
      window._tourbeIdentifie = false;
      const cat = cave.categories.find(c => c.id === catId);
      if (cat) cat.items.push(data);
      await autoLierIngredientParNom(data.nom, data.id);
    }

    fermerModal('modal-ajout');
    renderCave();
  };
 
  afficherModal('modal-ajout');
}
function normaliserPourComparaison(texte) {
  return (texte || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/^(sirop|liqueur|cordial|creme)\s+(de\s+|d')?/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function trouverDoublonPotentiel(nom) {
  const cible = normaliserPourComparaison(nom);
  return glossaireIngredients.find(g => {
    const candidats = [g.nom_canonique, ...(g.alias || [])].map(normaliserPourComparaison);
    return candidats.some(c => c === cible || (c.length > 3 && (c.includes(cible) || cible.includes(c))));
  });
}
 // Auto-liaison : si un item ajouté à Ma Cave porte exactement le même nom
// qu'un ingrédient de recette non lié, on fait le lien automatiquement.
// Comparaison texte pure (ilike), aucune IA, même mécanique que le bouton 🔗.
async function autoLierIngredientParNom(nomItem, itemCaveId) {
  const { data: ingsCorrespondants } = await db.from('recette_ingredients')
    .select('id, nom')
    .eq('user_id', currentUser.id)
    .ilike('nom', nomItem)
    .is('item_cave_id', null);

  if (!ingsCorrespondants || ingsCorrespondants.length === 0) {
    const feedbackVide = document.createElement('div');
    feedbackVide.className = 'toast-feedback';
    feedbackVide.style.background = 'var(--bg-warning)';
    feedbackVide.style.color = 'var(--text-warning)';
    feedbackVide.textContent = `⚠️ Aucune recette ne correspond exactement à "${nomItem}" — vérifie l'orthographe.`;
    document.body.appendChild(feedbackVide);
    setTimeout(() => feedbackVide.classList.add('visible'), 50);
    setTimeout(() => { feedbackVide.classList.remove('visible'); setTimeout(() => feedbackVide.remove(), 300); }, 3500);
    return;
  }

  await db.from('ingredients_alias').upsert({
    user_id: currentUser.id,
    nom_ingredient: nomItem.toLowerCase(),
    item_cave_id: itemCaveId
  }, { onConflict: 'user_id,nom_ingredient' });

  await db.from('recette_ingredients')
    .update({ item_cave_id: itemCaveId })
    .eq('user_id', currentUser.id)
    .ilike('nom', nomItem);

  ingredientsAlias[nomItem.toLowerCase()] = itemCaveId;
  recettes.forEach(r => {
    r.ingredients?.forEach(ing => {
      if (ing.nom?.toLowerCase() === nomItem.toLowerCase()) {
        ing.item_cave_id = itemCaveId;
      }
    });
  });

  const feedback = document.createElement('div');
  feedback.className = 'toast-feedback';
  feedback.textContent = `🔗 "${nomItem}" auto-lié à ${ingsCorrespondants.length} recette${ingsCorrespondants.length > 1 ? 's' : ''}`;
  document.body.appendChild(feedback);
  setTimeout(() => feedback.classList.add('visible'), 50);
  setTimeout(() => { feedback.classList.remove('visible'); setTimeout(() => feedback.remove(), 300); }, 2500);
}
function onTabChange(tab) {
  // Filet de sécurité : aucune modal ne devrait rester ouverte au changement d'onglet.
  if (!document.querySelector('.modal-overlay.visible')) {
    document.body.style.overflow = '';
  }

  if (tab === 'aacheter') chargerAAcheter();
  if (tab === 'concoctions') chargerConcoctions();
  if (tab === 'dashboard') chargerDashboard();
  if (tab === 'herboristerie') chargerHerboristerie();
  if (tab === 'ecole') chargerEcole();
}
 
document.querySelectorAll('nav button[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => onTabChange(btn.dataset.tab));
});
 
function onEquipToggle(details) {
  const stats = document.getElementById('equip-summary-stats');
  if (details.open && stats) {
    const chezSoi = equipements.filter(e => e.chez_soi).length;
    const kit     = equipements.filter(e => e.en_deplacement).length;
    stats.textContent = `${chezSoi} chez soi · ${kit} en kit`;
  }
}
 
async function toggleDetenu(itemId, catId) {
  const item = trouverItem(itemId, catId);
  if (!item) return;
  const detenu = item.detenu !== false;
  const nouvelEtat = !detenu;
  await db.from('items').update({ detenu: nouvelEtat }).eq('id', itemId).eq('user_id', currentUser.id);
  item.detenu = nouvelEtat;
  renderCave();
  if (typeof renderRecettes === 'function') renderRecettes();
}
 
// =============================================
// UTILITAIRES
// =============================================
 
function trouverItem(itemId, catId) {
  const cat = cave.categories.find(c => c.id === catId);
  return cat?.items.find(i => i.id === itemId);
}
 
let modalHistoryOuvert = false;

function afficherModal(id) {
  document.getElementById(id).classList.add('visible');
  document.body.style.overflow = 'hidden';
  if (!modalHistoryOuvert) {
    modalHistoryOuvert = true;
    history.pushState({ modalOuvert: true }, '', location.href);
  }
}
function fermerModal(id) {
  document.getElementById(id).classList.remove('visible');
  // Couper toute vidéo en lecture dans ce modal (évite qu'elle continue en fond)
  document.querySelectorAll(`#${id} iframe`).forEach(f => f.remove());
  const encoreUnModalOuvert = document.querySelector('.modal-overlay.visible');
  if (!encoreUnModalOuvert) {
    document.body.style.overflow = '';
  }
  if (modalHistoryOuvert && !encoreUnModalOuvert) {
    modalHistoryOuvert = false;
    history.back();
  }
}

// Filet de sécurité global : certaines fonctions de fermeture historiques
// ne passent pas par fermerModal() et oublient de réinitialiser le scroll.
// Cet observateur corrige automatiquement, peu importe la fonction en cause.
new MutationObserver(() => {
  if (!document.querySelector('.modal-overlay.visible')) {
    document.body.style.overflow = '';
  }
}).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });

window.addEventListener('popstate', () => {
  if (modalHistoryOuvert) {
    modalHistoryOuvert = false;
    document.querySelectorAll('.modal-overlay.visible').forEach(m => m.classList.remove('visible'));
  }
});
 
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('visible');
});
 
// =============================================
// ÉQUIPEMENTS
// =============================================
 
let equipements = [];
 
async function chargerEquipements() {
  const { data } = await db.from('equipements').select('*').order('categorie').order('nom');
  equipements = data || [];
  renderEquipements();
}
 
function renderEquipements() {
  const container = document.getElementById('equipements-container');
  if (!container) return;
 
  const categories = {
    essentiel: { label: 'Essentiels', items: [] },
    utile:     { label: 'Utiles',     items: [] },
    folklore:  { label: 'Folklore',   items: [] }
  };
 
  equipements.forEach(e => {
    if (categories[e.categorie]) categories[e.categorie].items.push(e);
  });
 
  const chezSoiCount = equipements.filter(e => e.chez_soi).length;
  const kitCount     = equipements.filter(e => e.en_deplacement).length;
 
  container.innerHTML = `
    <div class="equip-header">
      <div class="equip-stats">
        <span class="equip-stat">🏠 ${chezSoiCount} chez soi</span>
        <span class="equip-stat">🎒 ${kitCount} en déplacement</span>
      </div>
    </div>
    ${Object.entries(categories).map(([key, cat]) => `
      <div class="equip-categorie">
        <div class="equip-cat-label">${cat.label}</div>
        <div class="equip-items">
          ${cat.items.map(e => `
            <div class="equip-item">
              <div class="equip-nom">${e.nom}</div>
              ${e.prix_estime ? `<span class="item-prix">~${e.prix_estime}€</span>` : ''}
              <div class="equip-checkboxes">
                <label class="equip-check" title="Chez soi">
                  <input type="checkbox" ${e.chez_soi ? 'checked' : ''}
                    onchange="toggleEquipement('${e.id}', 'chez_soi', this.checked)">
                  🏠
                </label>
                <label class="equip-check" title="En déplacement">
                  <input type="checkbox" ${e.en_deplacement ? 'checked' : ''}
                    onchange="toggleEquipement('${e.id}', 'en_deplacement', this.checked)">
                  🎒
                </label>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}
  `;
}
 
async function toggleEquipement(id, champ, valeur) {
  const equip = equipements.find(e => e.id === id);
  if (!equip) return;
  await db.from('equipements').update({ [champ]: valeur }).eq('id', id).eq('user_id', currentUser.id);
  equip[champ] = valeur;
  const chezSoiCount = equipements.filter(e => e.chez_soi).length;
  const kitCount     = equipements.filter(e => e.en_deplacement).length;
  const stats = document.querySelector('.equip-stats');
  if (stats) stats.innerHTML = `
    <span class="equip-stat">🏠 ${chezSoiCount} chez soi</span>
    <span class="equip-stat">🎒 ${kitCount} en déplacement</span>
  `;
}
 
// =============================================
// CONCOCTIONS
// =============================================
 
let concoctions = [];
 
async function chargerConcoctions() {
  const container = document.getElementById('concoctions-container');
  if (!container) return;
 
  const [{ data: concs }, { data: etapes }] = await Promise.all([
    db.from('concoctions').select('*').order('date_creation', { ascending: false }),
    db.from('concoction_etapes').select('*').order('ordre')
  ]);
 
  concoctions = (concs || []).map(c => ({
    ...c,
    etapes: (etapes || []).filter(e => e.concoction_id === c.id)
  }));
 
  renderConcoctions();
  demarrerTimerConcoctions(); // ← AJOUT
}
 
function renderConcoctions() {
  const container = document.getElementById('concoctions-container');
  if (!container) return;
 
  const typeLabels = { batch: '🧊 Batch', maceration: '🌿 Macération', infusion: '☕ Infusion', liqueur: '🍯 Liqueur' };
  const statutLabels = { en_cours: 'En cours', pret: 'Prêt', termine: 'Terminé' };
  const statutClass  = { en_cours: 'statut-en-cours', pret: 'statut-plein', termine: 'statut-inconnu' };
 
  const enCours = concoctions.filter(c => c.statut === 'en_cours');
  const prets   = concoctions.filter(c => c.statut === 'pret');
 
  container.innerHTML = `
    <div class="conc-toolbar">
      <button class="btn btn-outline" onclick="ouvrirModalAjoutConcoction()">+ Ajouter</button>
    </div>
 
    ${enCours.length > 0 ? `
    <div class="conc-section">
      <h3 class="conc-section-titre">⏳ En cours (${enCours.length})</h3>
      ${enCours.map(c => renderConcoction(c, typeLabels, statutLabels, statutClass)).join('')}
    </div>` : ''}
 
    ${prets.length > 0 ? `
    <div class="conc-section">
      <h3 class="conc-section-titre">✅ Prêts</h3>
      ${prets.map(c => renderConcoction(c, typeLabels, statutLabels, statutClass)).join('')}
    </div>` : ''}
 
    ${concoctions.length === 0 ? '<div class="empty-state">Aucune concoction en cours. Commencez par le génépi !</div>' : ''}
  `;
}

// ← COLLER ICI après renderConcoctions
function demarrerTimerConcoctions() {
  const maintenant = new Date();
  const demainMinuit = new Date();
  demainMinuit.setHours(24, 0, 0, 0);
  const msJusquaMinuit = demainMinuit - maintenant;

  setTimeout(() => {
    renderConcoctions();
    setInterval(renderConcoctions, 86400000);
  }, msJusquaMinuit);
}
 
function renderConcoction(c, typeLabels, statutLabels, statutClass) {
  const today = new Date();
  today.setHours(0,0,0,0);
 
  const prochaineEtape = c.etapes?.find(e => !e.faite);
  const etapesFaites   = c.etapes?.filter(e => e.faite).length || 0;
  const etapesTotal    = c.etapes?.length || 0;
 
  let joursEtape = null;
  if (prochaineEtape?.date_etape) {
    const d = new Date(prochaineEtape.date_etape);
    joursEtape = Math.ceil((d - today) / 86400000);
  }
 
  let joursFin = null;
  if (c.date_fin) {
    const d = new Date(c.date_fin);
    joursFin = Math.ceil((d - today) / 86400000);
  }
 
  const urgenceClass = joursEtape !== null && joursEtape <= 3 ? 'conc-urgent' : '';
 const dernierePhoto = [...(c.etapes || [])].reverse().find(e => e.photo_url);
const photosCount = (c.etapes || []).filter(e => e.photo_url).length;
 

 return `
    <div class="conc-card ${urgenceClass}">
      <div class="conc-card-header">
        <div>
          <div class="conc-nom">${c.nom}</div>
          <div class="conc-meta">
            <span class="conc-type">${typeLabels[c.type] || c.type}</span>
            ${c.contenance_cl ? `<span class="conc-vol">${c.contenance_cl}cl</span>` : ''}
            <span class="item-statut ${statutClass[c.statut]}">${statutLabels[c.statut]}</span>
          </div>
        </div>
        ${joursFin !== null ? `
        <div class="conc-countdown ${joursFin <= 7 ? 'countdown-soon' : ''}">
          ${joursFin > 0 ? `<span class="countdown-val">${joursFin}</span><span class="countdown-label">jours</span>` : '<span class="countdown-val">🎉</span>'}
        </div>` : ''}
      </div>

      ${dernierePhoto ? `
      <div style="margin:10px 0;border-radius:10px;overflow:hidden;position:relative;">
        <img src="${dernierePhoto.photo_url}" style="width:100%;max-height:160px;object-fit:cover;display:block;">
        ${photosCount > 1 ? `
        <button onclick="ouvrirGalerieEvolution('${c.id}')" style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.6);border:none;color:#fff;border-radius:6px;padding:4px 10px;font-size:0.75rem;cursor:pointer;">
          📷 Voir l'évolution (${photosCount})
        </button>` : ''}
      </div>` : ''}

${etapesTotal > 0 && c.date_creation && c.date_fin ? (() => {
        const debut = new Date(c.date_creation);
        const fin = new Date(c.date_fin);
        const aujourdhui = new Date();
        aujourdhui.setHours(0,0,0,0);
        const totalJours = Math.ceil((fin - debut) / 86400000);
        const joursEcoules = Math.min(Math.max(0, Math.ceil((aujourdhui - debut) / 86400000)), totalJours);
        const pctCurseur = Math.round((joursEcoules / totalJours) * 100);
        const etapesAvecDate = (c.etapes || []).filter(e => e.date_etape).sort((a,b) => new Date(a.date_etape) - new Date(b.date_etape));
        const phases = etapesAvecDate.map((e, i) => {
          const dateDebut = i === 0 ? debut : new Date(etapesAvecDate[i-1].date_etape);
          const dateFin = new Date(e.date_etape);
          const duree = Math.max(1, Math.ceil((dateFin - dateDebut) / 86400000));
          return { titre: e.titre, duree, faite: e.faite };
        });
        const totalDuree = phases.reduce((s, p) => s + p.duree, 0);
        const couleurs = ['#1D9E75','#EF9F27','#378ADD','#D85A30','#7F77DD','#639922'];
        // Phase active = la première étape non cochée (reflète la vraie avancée, pas le calendrier théorique)
        const phaseActive = phases.find(p => !p.faite);
        return `
          <div style="margin:12px 0;">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">
              Jour ${joursEcoules}/${totalJours} · 
              <span style="color:var(--text-accent);font-weight:500;">${phaseActive ? 'Phase : ' + phaseActive.titre : 'Terminé'}</span>
              · Prêt dans ${Math.max(0, totalJours - joursEcoules)}j
            </div>
            <div style="position:relative;">
              <div style="display:flex;gap:2px;height:10px;border-radius:6px;overflow:hidden;">
${phases.map((p, i) => `<div style="flex:${p.duree};background:${p.faite ? couleurs[i % couleurs.length] : 'rgba(255,255,255,0.12)'};"></div>`).join('')}
              </div>
              <div style="position:absolute;top:-2px;left:${pctCurseur}%;width:3px;height:14px;background:var(--text-primary);border-radius:2px;transform:translateX(-50%);opacity:0.8;"></div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
              ${phases.map((p, i) => `
                <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:${p.faite ? couleurs[i % couleurs.length] : 'var(--text-muted)'};">
                  <span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:${p.faite ? couleurs[i % couleurs.length] : 'var(--border-strong)'};"></span>
                  ${p.titre}
                </div>
              `).join('')}
            </div>
          </div>
        `;
      })() : ''}

      ${c.description ? `<p class="conc-desc">${c.description}</p>` : ''}

      ${etapesTotal > 0 ? `
      <div class="conc-etapes">
        <div class="conc-etapes-progress">
          <div class="conc-progress-bar">
            <div class="conc-progress-fill" style="width:${Math.round((etapesFaites/etapesTotal)*100)}%"></div>
          </div>
          <span class="conc-progress-label">${etapesFaites}/${etapesTotal} étapes</span>
        </div>
        <div class="conc-etapes-list">
          ${c.etapes.map(e => `
            <div class="conc-etape ${e.faite ? 'etape-faite' : ''} ${e === prochaineEtape ? 'etape-prochaine' : ''}">
              <button class="etape-check" onclick="toggleEtapeConcoction('${c.id}', ${e.id}, ${!e.faite})">
                ${e.faite ? '✓' : '○'}
              </button>
              <div class="etape-content">
                <div class="etape-titre-conc">${e.titre}</div>
                <div class="etape-desc-conc">${e.description}</div>
                <div style="margin-top:6px;display:flex;align-items:center;gap:8px;">
                  ${e.photo_url ? `<img src="${e.photo_url}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">` : ''}
                  <label style="font-size:0.75rem;color:var(--text-accent);cursor:pointer;">
                    ${e.photo_url ? '↺ Changer' : '📷 Ajouter photo'}
                    <input type="file" accept="image/*" style="display:none" onchange="uploaderPhotoEtape(${e.id},'${c.id}',this)">
                  </label>
                </div>
                ${e.date_etape ? '<div class="etape-date">' + formatDate(e.date_etape) + (joursEtape !== null && e === prochaineEtape ? ' <span class="etape-jours' + (joursEtape <= 3 ? ' jours-urgent' : '') + '">(' + (joursEtape > 0 ? 'dans ' + joursEtape + 'j' : "aujourd'hui !") + ')</span>' : '') + '</div>' : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      ${c.notes ? `<div class="conc-notes">💡 ${c.notes}</div>` : ''}

<div class="conc-actions">
        ${c.statut === 'en_cours' ? `<button class="btn btn-outline btn-sm" onclick="marquerPret('${c.id}')">✅ Marquer prêt</button>` : ''}
        ${c.statut === 'pret' ? `
          <button class="btn btn-outline btn-sm" onclick="marquerEnCours('${c.id}')">↩ Remettre en cours</button>
          <button class="btn-primary btn-sm" onclick="ouvrirModalArchiver('${c.id}')">🏁 Archiver</button>
        ` : ''}
        <button class="btn btn-outline btn-sm" onclick="partagerConcoction('${c.id}', '${c.nom.replace(/'/g, "\\'")}')">🔗 Partager</button>
        <button class="btn-icon btn-supprimer" onclick="supprimerConcoction('${c.id}')" title="Supprimer définitivement">🗑</button>
      </div>
    </div>
  `;
}
 async function partagerConcoction(id, nom) {
  let conc = concoctions.find(c => c.id === id);
  let token = conc?.share_token;

  if (!token) {
    token = (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)));
    const { error } = await db.from('concoctions').update({ share_token: token }).eq('id', id).eq('user_id', currentUser.id);
    if (error) { alert('Erreur : ' + error.message); return; }
    if (conc) conc.share_token = token;
  }

  const url = `${window.location.origin}/concoction.html?token=${token}`;
  if (navigator.share) {
    try { await navigator.share({ title: nom, url }); }
    catch (e) { /* annulé par l'utilisateur */ }
  } else {
    await navigator.clipboard.writeText(url);
    alert('Lien copié ! ' + url);
  }
}
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
 
async function toggleEtapeConcoction(concId, etapeId, faite) {
  await db.from('concoction_etapes').update({ faite }).eq('id', etapeId).eq('user_id', currentUser.id);
  const conc = concoctions.find(c => c.id === concId);
  if (conc) {
    const etape = conc.etapes.find(e => e.id === etapeId);
    if (etape) etape.faite = faite;
  }
  renderConcoctions();
}
 async function uploaderPhotoEtape(etapeId, concId, input) {
  const file = input.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop();
  const path = `concoctions/${concId}/${etapeId}.${ext}`;
  const { error: upErr } = await db.storage.from('photos-realisations').upload(path, file, { upsert: true });
  if (upErr) { console.error('upload error', upErr); return; }
  const { data } = db.storage.from('photos-realisations').getPublicUrl(path);
  await db.from('concoction_etapes').update({ photo_url: data.publicUrl }).eq('id', etapeId);
  const conc = concoctions.find(c => c.id === concId);
  if (conc) {
    const etape = conc.etapes.find(e => e.id === etapeId);
    if (etape) etape.photo_url = data.publicUrl;
  }
  renderConcoctions();
}

function ouvrirGalerieEvolution(concId) {
  const conc = concoctions.find(c => c.id === concId);
  if (!conc) return;
  const photos = (conc.etapes || []).filter(e => e.photo_url);
  if (photos.length === 0) return;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem;gap:1rem;';
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;width:100%;max-width:480px;">
      <div style="color:#fff;font-size:1rem;font-weight:500;">Évolution — ${conc.nom}</div>
      <button onclick="this.closest('div[style*=fixed]').remove()" style="background:transparent;border:none;color:#fff;font-size:1.5rem;cursor:pointer;">✕</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:480px;overflow-y:auto;max-height:80vh;">
      ${photos.map(e => `
        <div style="background:rgba(255,255,255,0.05);border-radius:10px;overflow:hidden;">
          <img src="${e.photo_url}" style="width:100%;max-height:260px;object-fit:cover;display:block;">
          <div style="padding:8px 12px;">
            <div style="color:#fff;font-size:0.85rem;font-weight:500;">${e.titre}</div>
            ${e.date_etape ? `<div style="color:rgba(255,255,255,0.5);font-size:0.75rem;">${formatDate(e.date_etape)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  document.body.appendChild(modal);
}
async function marquerPret(concId) {
  await db.from('concoctions').update({ statut: 'pret' }).eq('id', concId).eq('user_id', currentUser.id);
  const conc = concoctions.find(c => c.id === concId);
  if (conc) conc.statut = 'pret';
  renderConcoctions();
}
 
async function marquerEnCours(concId) {
  await db.from('concoctions').update({ statut: 'en_cours' }).eq('id', concId).eq('user_id', currentUser.id);
  const conc = concoctions.find(c => c.id === concId);
  if (conc) conc.statut = 'en_cours';
  renderConcoctions();
}
let concoctionAArchiver = null;

function ouvrirModalArchiver(concId) {
  concoctionAArchiver = concId;
  const conc = concoctions.find(c => c.id === concId);
  document.getElementById('input-archiver-nom').value = conc?.nom || '';
  document.getElementById('input-archiver-notes').value = '';
  document.getElementById('input-archiver-cave').checked = true;
  document.getElementById('btn-confirmer-archiver').onclick = () => confirmerArchiver();
  afficherModal('modal-archiver-concoction');
}

async function confirmerArchiver() {
  const concId = concoctionAArchiver;
  if (!concId) return;
  const notes = document.getElementById('input-archiver-notes').value.trim();
  const ajouterCave = document.getElementById('input-archiver-cave').checked;

  // Mettre à jour le statut
  await db.from('concoctions').update({
    statut: 'termine',
    notes_degustation: notes || null
  }).eq('id', concId).eq('user_id', currentUser.id);

// Ajouter à Ma Cave si coché
  if (ajouterCave) {
    const conc = concoctions.find(c => c.id === concId);
    if (conc) {
const nomFinal = document.getElementById('input-archiver-nom')?.value?.trim() || conc.nom;
      const volume = parseFloat(document.getElementById('input-archiver-volume')?.value) || null;
      const { data: itemArchive } = await db.from('items').insert({
        id: 'concoction-' + Date.now(),
        user_id: currentUser.id,
        nom: nomFinal,
        category_id: 'concoctions',
        detenu: true,
        cl_total: volume,
        cl_restants: volume,
        info_description: notes || `Concoction maison archivée le ${new Date().toLocaleDateString('fr-FR')}.`
      }).select().single();
      if (itemArchive) await autoLierIngredientParNom(nomFinal, itemArchive.id);
    }
  }

  fermerModal('modal-archiver-concoction');
  await chargerConcoctions();
} 
async function supprimerConcoction(concId) {
  const conc = concoctions.find(c => c.id === concId);
  if (!confirm(`Supprimer définitivement "${conc?.nom}" ? Cette action est irréversible.`)) return;
  await db.from('concoctions').delete().eq('id', concId).eq('user_id', currentUser.id);
  concoctions = concoctions.filter(c => c.id !== concId);
  renderConcoctions();
}
 
function ouvrirModalAjoutConcoction(grimoire, dateDebut) {
 const modal = document.getElementById('modal-ajout-concoction');
  if (!modal) return;
  modal.querySelector('#input-conc-nom').value = grimoire ? grimoire.nom : '';
  modal.querySelector('#input-conc-type').value = grimoire ? (grimoire.avec_alcool ? 'maceration' : 'infusion') : 'batch';
  modal.querySelector('#input-conc-desc').value = grimoire ? (grimoire.description || '') : '';
  modal.querySelector('#input-conc-notes').value = grimoire ? (grimoire.notes_bartender || '') : '';
   modal.querySelector('#input-conc-date').value = dateDebut || new Date().toISOString().split('T')[0];

  modal.querySelector('#btn-sauver-concoction').onclick = async () => {
    const nom   = modal.querySelector('#input-conc-nom').value.trim();
    const type  = modal.querySelector('#input-conc-type').value;
    const desc  = modal.querySelector('#input-conc-desc').value.trim();
    const date  = modal.querySelector('#input-conc-date').value;
    const notes = modal.querySelector('#input-conc-notes').value.trim();
    if (!nom) return;

    const id = 'custom-conc-' + Date.now();
    const { data } = await db.from('concoctions').insert({
      id, user_id: currentUser.id, nom, type, description: desc,
      date_creation: date, statut: 'en_cours', notes,
      grimoire_id: grimoire ? grimoire.id : null
    }).select().single();

    if (data && grimoire) {
      // Générer les étapes types selon la catégorie du Grimoire
      const dateDebut = new Date(date);
      const duree = grimoire.duree_jours || 14;
      const dateFin = new Date(dateDebut);
      dateFin.setDate(dateFin.getDate() + duree);
      const dateMilieu = new Date(dateDebut);
      dateMilieu.setDate(dateMilieu.getDate() + Math.floor(duree / 2));

      const etapesParCategorie = {
        maceration: [
          { ordre: 1, titre: 'Mise en macération', description: 'Placer les ingrédients dans le bocal hermétique avec l\'alcool. Fermer et placer à l\'abri de la lumière.', date: dateDebut },
          { ordre: 2, titre: 'Vérification couleur et arômes', description: 'Goûter et observer la couleur. Ajuster si nécessaire.', date: dateMilieu },
          { ordre: 3, titre: 'Filtration', description: 'Filtrer à travers une étamine fine. Presser légèrement pour extraire le maximum.', date: new Date(dateFin.getTime() - 2 * 86400000) },
          { ordre: 4, titre: 'Mise en bouteille', description: 'Transvaser dans une bouteille propre hermétique. Étiqueter avec la date et le contenu.', date: new Date(dateFin.getTime() - 86400000) },
          { ordre: 5, titre: 'Dégustation officielle', description: 'Première dégustation — noter les arômes, la couleur et l\'équilibre.', date: dateFin }
        ],
        liqueur: [
          { ordre: 1, titre: 'Mise en macération', description: 'Placer les ingrédients dans le bocal hermétique avec l\'alcool. Fermer et placer à l\'abri de la lumière.', date: dateDebut },
          { ordre: 2, titre: 'Vérification couleur et arômes', description: 'Goûter et observer la couleur. Ajuster si nécessaire.', date: dateMilieu },
          { ordre: 3, titre: 'Ajout du sucre', description: `Filtrer et ajouter le sirop simple selon le ratio : ${grimoire.ratio_sucre || 'voir fiche Grimoire'}. Bien mélanger.`, date: new Date(dateFin.getTime() - 3 * 86400000) },
          { ordre: 4, titre: 'Filtration finale', description: 'Filtrer à nouveau finement. La liqueur doit être limpide.', date: new Date(dateFin.getTime() - 2 * 86400000) },
          { ordre: 5, titre: 'Mise en bouteille', description: 'Transvaser dans une bouteille propre hermétique. Étiqueter.', date: new Date(dateFin.getTime() - 86400000) },
          { ordre: 6, titre: 'Dégustation officielle', description: 'Première dégustation — noter les arômes, la couleur et l\'équilibre.', date: dateFin }
        ],
        'creme-de': [
          { ordre: 1, titre: 'Mise en macération', description: 'Placer les ingrédients dans le bocal hermétique avec l\'alcool.', date: dateDebut },
          { ordre: 2, titre: 'Vérification', description: 'Goûter et observer. Ajuster si nécessaire.', date: dateMilieu },
          { ordre: 3, titre: 'Ajout du sucre (ratio élevé)', description: `Filtrer et ajouter le sirop riche : ${grimoire.ratio_sucre || 'minimum 400g/L'}. Bien mélanger.`, date: new Date(dateFin.getTime() - 2 * 86400000) },
          { ordre: 4, titre: 'Mise en bouteille', description: 'Transvaser dans une bouteille propre. Étiqueter avec date et ratio sucre.', date: new Date(dateFin.getTime() - 86400000) },
          { ordre: 5, titre: 'Dégustation officielle', description: 'Première dégustation.', date: dateFin }
        ],
        sirop: [
          { ordre: 1, titre: 'Préparation des ingrédients', description: 'Peser et préparer tous les ingrédients. Stériliser les contenants.', date: dateDebut },
          { ordre: 2, titre: 'Infusion', description: 'Infuser les ingrédients dans l\'eau chaude selon la recette. Surveiller la durée.', date: dateDebut },
          { ordre: 3, titre: 'Filtration', description: 'Filtrer finement à travers une étamine ou un filtre à café.', date: dateDebut },
          { ordre: 4, titre: 'Mise en bouteille', description: 'Ajouter le sucre, mélanger jusqu\'à dissolution complète. Mettre en bouteille au frigo.', date: dateFin }
        ],
        shrub: [
          { ordre: 1, titre: 'Macération à froid', description: 'Mélanger les fruits avec le sucre. Laisser macérer 48h au frigo.', date: dateDebut },
          { ordre: 2, titre: 'Ajout du vinaigre', description: 'Filtrer le jus obtenu et ajouter le vinaigre de cidre. Bien mélanger.', date: new Date(dateDebut.getTime() + 2 * 86400000) },
          { ordre: 3, titre: 'Filtration et mise en bouteille', description: 'Filtrer finement et mettre en bouteille au frigo.', date: dateFin }
        ],
        teinture: [
          { ordre: 1, titre: 'Mise en macération', description: 'Placer les ingrédients dans l\'alcool fort (70°+). Fermer hermétiquement.', date: dateDebut },
          { ordre: 2, titre: 'Vérification intensité', description: 'Goûter — très puissant. Ajuster la durée selon l\'intensité souhaitée.', date: dateMilieu },
          { ordre: 3, titre: 'Filtration fine', description: 'Filtrer à travers étamine très fine ou filtre à café. Mettre en petite bouteille compte-gouttes.', date: dateFin }
        ],
        infusion: [
          { ordre: 1, titre: 'Préparation', description: 'Préparer les ingrédients. Stériliser les contenants.', date: dateDebut },
          { ordre: 2, titre: 'Infusion', description: 'Infuser selon la recette du Grimoire. Surveiller la durée et la couleur.', date: dateDebut },
          { ordre: 3, titre: 'Filtration et mise en bouteille', description: 'Filtrer et mettre en bouteille. Conserver au frigo.', date: dateFin }
        ]
      };

      const etapes = etapesParCategorie[grimoire.categorie] || etapesParCategorie['maceration'];
      const etapesAInserer = etapes.map(e => ({
        concoction_id: data.id,
        user_id: currentUser.id,
        ordre: e.ordre,
        titre: e.titre,
        description: e.description,
        date_etape: e.date.toISOString().split('T')[0],
        faite: false
      }));

      const { data: etapesData } = await db.from('concoction_etapes').insert(etapesAInserer).select();
}

    fermerModal('modal-ajout-concoction');
await chargerConcoctions();
  };

  afficherModal('modal-ajout-concoction');
}
 
// =============================================
// À ACHETER
// =============================================
 

// =============================================
// À ACHETER — Refonte complète
// Remplace entièrement la fonction chargerAAcheter()
// dans app.js
// =============================================

// Liste des ingrédients colorants
const COLORANTS_BAR = [
  'curaçao','curacao','grenadine','crème de violette','violette',
  'sirop de framboise','sirop de cassis','sirop de menthe',
  'blue curaçao','orgeat','falernum','sirop de rose','hibiscus'
];

function estColorant(nom) {
  return COLORANTS_BAR.some(c => nom.toLowerCase().includes(c));
}

// Calcul score composite : recettes + diversité gustative + ratio prix/impact
function calculerScoreItem(item) {
  const recettes = item.recettesDetail.length;
  const prix     = parseFloat(item.prix) || 0;
  const gouts    = item.gouts?.length || 0;
  if (!recettes) return 0;
  const coutParRecette = prix > 0 ? prix / recettes : 0;
  return Math.round((recettes * 10) + (gouts * 3) - coutParRecette);
}
function partagerListeAAcheter() {
  const caveIds = getItemsCave();
  const categoriesExclues = ['garde-manger', 'ingredients-frais', 'ponctuels'];
  const scoreMap = {};
  recettes.forEach(r => {
    const manquants = (r.ingredients || []).filter(i =>
      i.item_cave_id && !caveIds.has(i.item_cave_id) && !i.optionnel
    );
    manquants.forEach(ing => {
      if (!scoreMap[ing.item_cave_id]) {
        scoreMap[ing.item_cave_id] = { nom: ing.nom, prix: null, recettes: 0 };
      }
      scoreMap[ing.item_cave_id].recettes++;
    });
  });
  (cave?.items || []).forEach(i => {
    if (scoreMap[i.id]) scoreMap[i.id].prix = i.prix_estime;
  });
  const liste = Object.values(scoreMap)
    .filter(i => i.recettes > 0)
    .sort((a, b) => b.recettes - a.recettes);
  const stockBas = (cave?.items || []).filter(i =>
    i.detenu === true &&
    i.cl_total > 0 &&
    i.cl_restants !== null &&
    (i.cl_restants / i.cl_total) <= 0.10 &&
    !categoriesExclues.includes(i.category_id) &&
    !i.ne_pas_reapprovisionner
  );
  const total = liste.reduce((s, i) => s + (parseFloat(i.prix) || 0), 0);
  let texte = '🛒 Liste À acheter — Bar à Cocktail\n\n';
  liste.forEach((item, idx) => {
    const prix = item.prix ? ` (~${item.prix}€)` : '';
    const nb = item.recettes === 1 ? '1 recette' : `${item.recettes} recettes`;
    texte += `${idx + 1}. ${item.nom}${prix} — débloque ${nb}\n`;
  });
  if (stockBas.length > 0) {
    texte += '\n⚠️ Stock bas\n';
    stockBas.forEach(i => { texte += `• ${i.nom} — à racheter\n`; });
  }
  if (total > 0) texte += `\n💶 Total estimé : ~${Math.round(total)}€`;
  if (navigator.share) {
    navigator.share({ title: 'Liste À acheter — Bar à Cocktail', text: texte }).catch(() => {});
  } else {
    navigator.clipboard.writeText(texte).then(() => {
      alert('✅ Liste copiée dans le presse-papier !');
    });
  }
}
let aacheterModeTri = 'impact'; // 'impact' ou 'budget'

async function chargerAAcheter() {
  const container = document.getElementById('aacheter-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Calcul en cours…</div>';

  // IDs des items détenus en cave
  const caveIds = getItemsCave();

const { data: allItems } = await db.from('items').select('id, nom, prix_estime, detenu, category_id, cl_total, cl_restants, ne_pas_reapprovisionner').eq('user_id', currentUser.id);
 // Items à stock bas (détenu mais ≤ 10% restant)
const categoriesExclues = ['garde-manger', 'ingredients-frais', 'ponctuels'];
const stockBas = (allItems || []).filter(i => 
  i.detenu === true &&
  i.cl_total > 0 &&
  i.cl_restants !== null &&
  (i.cl_restants / i.cl_total) <= 0.10 &&
  !categoriesExclues.includes(i.category_id) &&
  !i.ne_pas_reapprovisionner
).map(i => ({
  id: i.id,
  nom: i.nom,
  prix: i.prix_estime,
  category_id: i.category_id,
  stockBas: true,
  pctRestant: Math.round((i.cl_restants / i.cl_total) * 100),
  recettesDetail: recettes.filter(r => 
    (r.ingredients || []).some(ing => ing.item_cave_id === i.id)
  ),
  gouts: []
}));
chargerAAcheter
  // Calcul score par item MANQUANT (non détenu)
  const scoreMap = {};
  recettes.forEach(r => {
    const manquants = (r.ingredients || []).filter(i =>
      i.item_cave_id && !caveIds.has(i.item_cave_id) && !i.optionnel
    );
    manquants.forEach(ing => {
      if (!scoreMap[ing.item_cave_id]) {
        const itemData = allItems?.find(i => i.id === ing.item_cave_id);
        // Ignorer si l'item est détenu
        if (itemData?.detenu !== false && caveIds.has(ing.item_cave_id)) return;
        scoreMap[ing.item_cave_id] = {
          id:            ing.item_cave_id,
          nom:           ing.nom,
          prix:          itemData?.prix_estime || null,
          category_id:   itemData?.category_id || null,
          recettesDetail: [],
          gouts:         []
        };
      }
      scoreMap[ing.item_cave_id].recettesDetail.push(r);
      // Collecter les goûts uniques apportés
      (r.gouts || []).forEach(g => {
        if (!scoreMap[ing.item_cave_id].gouts.includes(g)) {
          scoreMap[ing.item_cave_id].gouts.push(g);
        }
      });
    });
  });

 const allScored = Object.values(scoreMap)
    .filter(i => i.recettesDetail.length > 0)
    .map(i => ({ ...i, score: calculerScoreItem(i) }))
    .sort((a, b) => b.score - a.score);

  // Tri Budget : par prix croissant au sein de chaque groupe
  const trierParBudget = (items) => {
    if (aacheterModeTri !== 'budget') return items;
    return [...items].sort((a, b) => {
      const prixA = parseFloat(a.prix) || 9999;
      const prixB = parseFloat(b.prix) || 9999;
      return prixA - prixB;
    });
  };

  if (allScored.length === 0) {
    container.innerHTML = '<div class="empty-state">🎉 Tu as tous les ingrédients pour toutes tes recettes !</div>';
    return;
  }

  // Catégories
  const catGroupes = {
    spiritueux: { label: '🥃 Spiritueux',       ids: ['a-acheter-spirits','gin','vodka','whisky','mezcal-tequila','rhum','eaux-de-vie'] },
    liqueurs:   { label: '🍯 Liqueurs',          ids: ['a-acheter-liqueurs','liqueurs','triples-secs','vermouth','bitters'] },
    vins_amers: { label: '🍷 Vins & Amers',      ids: ['a-acheter-vins','a-acheter-bitters','bulles'] },
    sirops:     { label: '🍬 Sirops & Épicerie', ids: ['a-acheter-sirops','sirops','ingredients-frais'] }
  };

  // Répartir par groupe
  const grouped = {};
  Object.keys(catGroupes).forEach(k => grouped[k] = []);

  allScored.forEach(item => {
    let placed = false;
    for (const [key, groupe] of Object.entries(catGroupes)) {
      if (groupe.ids.includes(item.category_id)) {
        grouped[key].push(item);
        placed = true;
        break;
      }
    }
    if (!placed) grouped['spiritueux'].push(item);
  });

  // Meilleur achat = score le plus élevé toutes catégories
  const meilleur = allScored[0];

  // Filtre actif
  const filtreActif = window.aacheterFiltreActif || 'tout';
// Items masqués (ne_pas_reapprovisionner = true)
const itemsMasques = (allItems || []).filter(i =>
  i.detenu === true &&
  i.cl_total > 0 &&
  i.cl_restants !== null &&
  (i.cl_restants / i.cl_total) <= 0.10 &&
  !categoriesExclues.includes(i.category_id) &&
  i.ne_pas_reapprovisionner === true
).map(i => ({
  id: i.id,
  nom: i.nom,
  pctRestant: Math.round((i.cl_restants / i.cl_total) * 100)
}));
container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;">
      <div style="display:flex;gap:6px;">
        <button class="btn-outline ${aacheterModeTri === 'impact' ? 'active' : ''}" 
          onclick="aacheterModeTri='impact'; chargerAAcheter()" 
          style="font-size:0.8rem;padding:6px 12px;">🏆 Impact</button>
        <button class="btn-outline ${aacheterModeTri === 'budget' ? 'active' : ''}" 
          onclick="aacheterModeTri='budget'; chargerAAcheter()" 
          style="font-size:0.8rem;padding:6px 12px;">💶 Budget</button>
      </div>
      <button class="btn-outline" onclick="partagerListeAAcheter()" style="font-size:0.85rem;">
        📤 Partager
      </button>
    </div>

    <!-- FILTRES -->
    <div class="aacheter-filtres">
      <button class="aacheter-filtre-btn ${filtreActif === 'tout' ? 'active' : ''}"
        onclick="window.aacheterFiltreActif='tout'; chargerAAcheter()">Tout</button>
      ${Object.entries(catGroupes).map(([key, g]) => `
        <button class="aacheter-filtre-btn ${filtreActif === key ? 'active' : ''}"
          onclick="window.aacheterFiltreActif='${key}'; chargerAAcheter()">
          ${g.label}
        </button>
      `).join('')}
    </div>
<!-- ANALYSER UNE BOUTEILLE -->
    <div class="aacheter-groupe">
      <div class="aacheter-groupe-titre">🔍 Analyser une bouteille</div>
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <input type="text" id="analyser-input" placeholder="Ex: Campari, Monkey 47, Mezcal El Silencio…"
          style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--text-primary);font-size:14px;"
          onkeydown="if(event.key==='Enter') analyserBouteille()">
        <button id="analyser-btn" onclick="analyserBouteille()"
          style="padding:10px 16px;border-radius:8px;border:1px solid rgba(255,165,0,0.4);background:rgba(255,165,0,0.1);color:#ffaa00;font-size:14px;cursor:pointer;white-space:nowrap;">
          🔍 Analyser
        </button>
      </div>
            <button id="analyser-photo-btn" onclick="document.getElementById('analyser-photo-input').click()"
        style="width:100%;padding:10px 16px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-secondary);font-size:14px;cursor:pointer;">
        📷 Analyser depuis une photo (appareil ou galerie)
      </button>
<div id="analyser-result"></div>
      <button class="btn-outline" style="width:100%;margin-top:8px;font-size:0.8rem" onclick="ouvrirHistoriqueAnalyses()">🕐 Historique des analyses</button>
    </div>
${stockBas.length > 0 || itemsMasques.length > 0 ? `
<div class="aacheter-groupe">
  <div class="aacheter-groupe-titre">⚠️ Stock bas — à racheter bientôt</div>
  ${stockBas.map(item => renderItemAAcheter(item, false)).join('')}
  ${itemsMasques.length > 0 ? `
  <div style="margin-top:8px;">
    <button onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.textContent=this.textContent.includes('▶')?'▼ Masqués (${itemsMasques.length})':'▶ Masqués (${itemsMasques.length})';"
      style="background:none;border:none;color:var(--text-muted);font-size:0.8rem;cursor:pointer;padding:4px 0;">
      ▶ Masqués (${itemsMasques.length})
    </button>
    <div style="display:none;margin-top:6px;">
      ${itemsMasques.map(i => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;">
          <div>
            <span style="font-size:0.85rem;color:var(--text-secondary);">${i.nom}</span>
            <span style="font-size:0.72rem;color:var(--text-muted);margin-left:6px;">${i.pctRestant}% restant</span>
          </div>
          <button onclick="toggleReapprovisionner('${i.id}', false)" 
            style="background:var(--bg-success);color:var(--text-success);border:1px solid var(--border-success);border-radius:6px;padding:4px 10px;font-size:0.75rem;cursor:pointer;">
            🔔 Réactiver
          </button>
        </div>
      `).join('')}
    </div>
  </div>` : ''}
</div>` : ''}

  <!-- MEILLEUR ACHAT -->
    ${filtreActif === 'tout' ? `
    <div class="aacheter-top-card">
      <div class="aacheter-top-label">🥇 Meilleur achat — impact maximal</div>
      ${renderItemAAcheter(meilleur, true)}
    </div>` : ''}

  
    <!-- PAR CATÉGORIE -->
    ${Object.entries(catGroupes).map(([key, groupe]) => {
      if (filtreActif !== 'tout' && filtreActif !== key) return '';
      const items = grouped[key];
      if (!items.length) return '';
      return `
        <div class="aacheter-groupe">
          <div class="aacheter-groupe-titre">${groupe.label}</div>
${trierParBudget(items).map(item => renderItemAAcheter(item, false)).join('')}
        </div>
      `;
    }).join('')}

    <!-- APPORT GUSTATIF -->
    <div class="aacheter-groupe">
      <button class="btn btn-outline btn-apport" id="btn-apport-gustatif" onclick="chargerApportGustatif()">
        ✨ Analyser l'apport gustatif (Claude)
      </button>
<div id="apport-gustatif-result"></div>
    </div>
  `;

  renderAAcheterParRecette();
}
async function analyserBouteille(forcerNouvelleAnalyse = false) {
  const nom = document.getElementById('analyser-input')?.value?.trim();
  if (!nom) return;

  const btn = document.getElementById('analyser-btn');
  const result = document.getElementById('analyser-result');
  btn.disabled = true;
  btn.textContent = 'Analyse en cours…';
  result.innerHTML = '<div class="simulateur-vide">Interrogation du bartender IA…</div>';

  // Vérifie si une analyse existe déjà pour ce nom (évite un appel IA redondant)
  if (!forcerNouvelleAnalyse) {
    const { data: existante } = await db.from('analyses_bouteilles')
      .select('*')
      .eq('user_id', currentUser.id)
      .ilike('nom_recherche', nom)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

if (existante) {
      analyseCourante = existante.resultat;
      result.innerHTML = construireResultatAnalyse(existante.resultat, nom) +
        `<div style="text-align:center;margin-top:10px">
          <span style="font-size:0.72rem;color:var(--text-muted)">Résultat du ${new Date(existante.created_at).toLocaleDateString('fr-FR')}</span>
          <button class="btn-outline" style="display:block;margin:8px auto 0;font-size:0.75rem;padding:6px 12px" onclick="analyserBouteille(true)">🔄 Relancer une nouvelle analyse</button>
        </div>`;
      btn.disabled = false;
      btn.textContent = '🔍 Analyser';
      return;
    }
  }

  const caveListe = [...getNomsCaveActive()].join(', ');

  try {
    const rep = await fetch('/api/analyser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, cave: caveListe })
    });
    const data = await rep.json();

    if (!data.identifie) {
      result.innerHTML = '<div class="simulateur-vide">Alcool non reconnu. Essaie un nom plus précis.</div>';
} else {
      analyseCourante = data;
      result.innerHTML = construireResultatAnalyse(data, nom);
      // Sauvegarde pour réutilisation future
      await db.from('analyses_bouteilles').insert({
        id: 'analyse-' + Date.now(),
        user_id: currentUser.id,
        nom_recherche: nom,
        resultat: data
      });
    }
  } catch (e) {
    result.innerHTML = '<div class="simulateur-vide">Erreur de connexion. Réessaie.</div>';
  }

  btn.disabled = false;
  btn.textContent = '🔍 Analyser';
}
function attendreElement(id, essaisMax = 30) {
  return new Promise(resolve => {
    let essais = essaisMax;
    const check = () => {
      const el = document.getElementById(id);
      if (el || essais <= 0) { resolve(el); return; }
      essais--;
      setTimeout(check, 150);
    };
    check();
  });
}

function redimensionnerImage(fichier, maxDim = 1280, qualite = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(fichier);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Compression échouée')); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      }, 'image/jpeg', qualite);
    };
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = url;
  });
}

async function analyserBouteillePhoto(event) {
  const fichier = event.target.files?.[0];
  if (!fichier) return;

  const btnAacheter = document.querySelector('nav button[data-tab="aacheter"]');
  if (btnAacheter && !btnAacheter.classList.contains('active')) btnAacheter.click();

const result = await attendreElement('analyser-result', 60);
  const photoBtn = await attendreElement('analyser-photo-btn', 60);
  if (!result || !photoBtn) {
    alert('La page n\'a pas fini de se recharger à temps. Retourne sur À acheter et réessaie.');
    return;
  }

  photoBtn.disabled = true;
  photoBtn.textContent = '📷 Compression de la photo…';
  result.innerHTML = '<div class="simulateur-vide">Interrogation du bartender IA…</div>';

const caveListe = [...getNomsCaveActive()].join(', ');

  try {
    const image_base64 = await redimensionnerImage(fichier);

    photoBtn.textContent = '📷 Analyse en cours…';

    const rep = await fetch('/api/analyser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64, cave: caveListe })
    });

    if (!rep.ok) {
      result.innerHTML = `<div class="simulateur-vide">Erreur serveur (${rep.status}). Réessaie, ou passe par le champ texte.</div>`;
      photoBtn.disabled = false;
      photoBtn.textContent = '📷 Analyser depuis une photo (appareil ou galerie)';
      event.target.value = '';
      return;
    }

    const data = await rep.json();

    if (!data.identifie) {
      result.innerHTML = '<div class="simulateur-vide">Bouteille non reconnue sur la photo. Essaie un angle plus net sur l\'étiquette, ou passe par le champ texte.</div>';
    } else {
      result.innerHTML = construireResultatAnalyse(data, data.nom_complet || '');
    }
  } catch (e) {
    result.innerHTML = '<div class="simulateur-vide">Erreur : ' + (e?.message || e) + '. Réessaie.</div>';
  }

  photoBtn.disabled = false;
  photoBtn.textContent = '📷 Analyser depuis une photo (appareil ou galerie)';
  event.target.value = '';
}
function construireResultatAnalyse(data, nomPourRecherche) {
  const caveIds = getItemsCave();
  const itemMatch = (cave?.categories || [])
    .flatMap(c => c.items)
    .find(i => i.nom.toLowerCase().includes((nomPourRecherche || '').toLowerCase()) && i.detenu === false);

  let recettesHTML = '';
  if (itemMatch) {
    const simulCave = new Set([...caveIds, itemMatch.id]);
    const debloquees = recettes.filter(r => {
      const avant  = (r.ingredients || []).filter(i => i.item_cave_id && !caveIds.has(i.item_cave_id) && !i.optionnel).length;
      const apres  = (r.ingredients || []).filter(i => i.item_cave_id && !simulCave.has(i.item_cave_id) && !i.optionnel).length;
      return avant > 0 && apres === 0;
    });
    if (debloquees.length) {
      recettesHTML = `
        <div class="analyser-section">
          <div class="analyser-label">🍹 Recettes débloquées (+${debloquees.length})</div>
          ${debloquees.map(r => `
            <div class="simulateur-recette" onclick="ouvrirFicheRecette('${r.id}')">
              <span class="simulateur-recette-nom">${r.nom}</span>
              <span class="simulateur-recette-gouts">${(r.gouts || []).join(', ')}</span>
            </div>`).join('')}
        </div>`;
    }
  }

  const verdictClass = {
    ACHETER: 'analyser-verdict--acheter',
    PASSER: 'analyser-verdict--passer',
    DOUBLON: 'analyser-verdict--doublon',
    MIEUX_AILLEURS: 'analyser-verdict--mieux'
  }[data.verdict] || '';

  return `
    <div class="analyser-card">
      <div class="analyser-nom">${data.nom_complet}</div>
      <div class="analyser-meta">${data.categorie} · ${data.degre}° · ${data.profil_gustatif}</div>
${data.cocktails_possibles?.length ? `
      <div class="analyser-section">
        <div class="analyser-label">🍹 Cocktails réalisables (${data.cocktails_possibles.length})</div>
        ${data.cocktails_possibles.map((c, idx) => {
          const nomsCaveActive = getNomsCaveActive();
          const ings = c.ingredients || [];
          const manquants = ings.filter(ing => !ingredientEnCaveActive(ing.nom, nomsCaveActive));
          const recetteExistante = recettes.find(r => r.nom.toLowerCase().trim() === c.nom.toLowerCase().trim());
          const uid = `analyse-cocktail-${idx}-${Date.now()}`;

          return `
            <div class="simulateur-recette" style="flex-direction:column;align-items:flex-start;gap:0;cursor:pointer;margin-bottom:10px;padding:12px;border:1px solid var(--border);border-radius:10px" onclick="toggleDetailCocktailAnalyse('${uid}')">
              <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
                <span class="simulateur-recette-nom">${recetteExistante ? '📖' : '✨'} ${c.nom}</span>
                <span style="font-size:0.72rem;color:var(--text-muted)">▾</span>
              </div>
              <span class="simulateur-recette-gouts">${manquants.length ? '⚠️ manque ' + manquants.length + ' ingrédient' + (manquants.length > 1 ? 's' : '') : '✓ réalisable maintenant'}</span>
              <div id="${uid}" style="display:none;width:100%;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
                ${ings.map(ing => {
                  const enCave = ingredientEnCaveActive(ing.nom, nomsCaveActive);
                  return `<div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:3px 0">
                    <span>${enCave ? '✅' : '❌'} ${ing.nom}</span>
                    <span style="color:var(--text-muted)">${ing.quantite || ''} ${ing.unite || ''}</span>
                  </div>`;
                }).join('')}
${recetteExistante ? `
                <button class="btn-outline" style="font-size:0.72rem;padding:4px 10px;margin-top:8px" onclick="event.stopPropagation(); ouvrirFicheRecette('${recetteExistante.id}')">📖 Voir la fiche recette</button>
                ` : `
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
                  ${manquants.length ? `<button class="btn-outline" style="font-size:0.72rem;padding:4px 10px" onclick="event.stopPropagation(); ajouterIngredientsManquantsAAcheter(${JSON.stringify(manquants.map(m => m.nom)).replace(/"/g, '&quot;')})">🛒 Ajouter à "À acheter"</button>` : ''}
                  <button class="btn-primary" style="font-size:0.72rem;padding:4px 10px" onclick="event.stopPropagation(); enregistrerRecetteDepuisIA(${idx})">💾 Enregistrer cette recette</button>
                </div>
                `}
              </div>
            </div>`;
        }).join('')}
      </div>` : ''}
      ${data.doublon_cave ? `
      <div class="analyser-section analyser-section--warning">
        <div class="analyser-label">⚠️ Déjà similaire en cave</div>
        <div class="analyser-texte">${data.doublon_cave} — ${data.doublon_note}</div>
      </div>` : ''}

      ${recettesHTML}

      ${data.meilleure_version ? `
      <div class="analyser-section">
        <div class="analyser-label">⭐ Meilleure version</div>
        <div class="analyser-texte">${data.meilleure_version}${data.meilleure_version_prix ? ' — ~' + data.meilleure_version_prix : ''}</div>
      </div>` : ''}

      ${data.variante_moins_chere ? `
      <div class="analyser-section">
        <div class="analyser-label">💸 Alternative moins chère</div>
        <div class="analyser-texte">${data.variante_moins_chere}${data.variante_moins_chere_prix ? ' — ~' + data.variante_moins_chere_prix : ''}</div>
      </div>` : ''}

      <div class="analyser-section">
        <div class="analyser-label">🍸 Avis bartender</div>
        <div class="analyser-texte">${data.complementarite}</div>
      </div>

      ${data.anecdote_pedagogique ? `
      <div class="analyser-section">
        <div class="analyser-label">🎓 Le saviez-tu</div>
        <div class="analyser-texte">${data.anecdote_pedagogique}</div>
      </div>` : ''}

      <div class="analyser-verdict ${verdictClass}">${data.verdict_raison}</div>

      ${itemMatch ? `<button class="btn btn-outline" style="margin-top:12px;width:100%" onclick="marquerAchete('${itemMatch.id}', '${itemMatch.category_id}', '${itemMatch.nom.replace(/'/g, "\\'")}')">✓ Marquer comme acheté</button>` : ''}
    </div>
  `;
}
async function ajouterIngredientsManquantsAAcheter(noms) {
  for (const nom of noms) {
    const id = 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    await db.from('items').insert({
      id, user_id: currentUser.id, nom, category_id: 'ponctuels', detenu: false
    });
  }
  alert(`${noms.length} ingrédient${noms.length > 1 ? 's' : ''} ajouté${noms.length > 1 ? 's' : ''} à "À acheter".`);
  await chargerCave();
}
function toggleDetailCocktailAnalyse(uid) {
  const el = document.getElementById(uid);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
function switchSousOngletAAcheter(panel, btn) {
  document.querySelectorAll('#section-aacheter .conc-sous-onglet').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('aacheter-panel-ingredient').style.display = panel === 'ingredient' ? '' : 'none';
  document.getElementById('aacheter-panel-recette').style.display = panel === 'recette' ? '' : 'none';
  if (panel === 'recette') renderAAcheterParRecette();
}

function renderAAcheterParRecette() {
  const container = document.getElementById('aacheter-recette-container');
  if (!container) return;

  const caveIds = getItemsCave();
  const paliers = {};
  recettes.forEach(r => {
    const manquants = (r.ingredients || []).filter(i => i.item_cave_id && !caveIds.has(i.item_cave_id) && !i.optionnel);
    const n = manquants.length;
    if (n >= 1 && n <= 4) {
      if (!paliers[n]) paliers[n] = [];
      paliers[n].push({ recette: r, manquants });
    }
  });

  const paliersDisponibles = Object.keys(paliers).map(Number).sort((a, b) => a - b);
  if (paliersDisponibles.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎉</div>
        <div class="empty-state-titre">Tout est déjà réalisable</div>
        <div class="empty-state-texte">Aucune recette ne dépend d'un ingrédient manquant en ce moment.</div>
      </div>`;
    return;
  }

  const MAX = 8;
  const labelPalier = { 1: "À 1 achat de la victoire", 2: "À 2 achats de la victoire", 3: "À 3 achats de la victoire", 4: "À 4 achats de la victoire" };

  const renderCarte = (recette, manquants, accent) => `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:6px;cursor:pointer"
      onclick="ouvrirFicheRecette('${recette.id}')">
      <div style="font-weight:600;font-size:0.88rem;margin-bottom:6px">${recette.nom}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${manquants.map(m => `
          <span style="font-size:0.72rem;padding:2px 9px;border-radius:20px;
            background:${accent ? 'var(--bg-accent)' : 'var(--bg-card)'};
            color:${accent ? 'var(--text-accent)' : 'var(--text-secondary)'};
            border:1px solid ${accent ? 'var(--accent)' : 'var(--border)'}">${m.nom}</span>
        `).join('')}
      </div>
    </div>`;

  container.innerHTML = paliersDisponibles.map(n => {
    const items = paliers[n];
    return `
      <div class="aacheter-groupe">
        <div style="font-size:0.8rem;font-weight:600;color:${n === 1 ? 'var(--text-accent)' : 'var(--text-secondary)'};margin:10px 0 8px">
          ${labelPalier[n] || `À ${n} achats de la victoire`} (${items.length})
        </div>
        ${items.slice(0, MAX).map(({ recette, manquants }) => renderCarte(recette, manquants, n === 1)).join('')}
        ${items.length > MAX ? `<div style="text-align:center;font-size:0.78rem;color:var(--text-secondary);padding:4px 0">+${items.length - MAX} autre${items.length - MAX > 1 ? 's' : ''}</div>` : ''}
      </div>`;
  }).join('');
}
function renderItemAAcheter(item, isTop) {
  const nbRecettes      = item.recettesDetail.length;
  const prix            = parseFloat(item.prix) || null;
  const coutParRecette  = prix && nbRecettes ? (prix / nbRecettes).toFixed(1) : null;
  const colorant        = estColorant(item.nom);

  const badgeRecettes = nbRecettes >= 6
    ? `<span class="aacheter-badge aacheter-badge--top">+${nbRecettes} recettes</span>`
    : nbRecettes >= 3
    ? `<span class="aacheter-badge aacheter-badge--mid">+${nbRecettes} recettes</span>`
    : `<span class="aacheter-badge aacheter-badge--low">+${nbRecettes} recette${nbRecettes > 1 ? 's' : ''}</span>`;

  return `
    <div class="aacheter-item ${isTop ? 'aacheter-item--top' : ''}">
      <div class="aacheter-item-header">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
          <div class="aacheter-nom">${item.nom}</div>
         ${(() => {
  const catToEcole = {
    'gin': 'gin',
    'vodka': 'vodka',
    'whisky': 'whisky-scotch',
    'rhum': 'rhum',
    'mezcal-tequila': 'mezcal-tequila',
    'eaux-de-vie': 'cognac-armagnac',
    'liqueurs': 'liqueurs',
    'triples-secs': 'liqueurs',
    'bitters': 'bitters',
    'vermouth': 'vermouth'
  };
  const ecoleId = catToEcole[item.category_id];
  const ficheEcole = ecoleId ? ecoleData.alcools.find(e => e.id === ecoleId) : null;
  return ficheEcole ? `<a style="font-size:0.72rem;color:var(--text-accent);text-decoration:none;white-space:nowrap;" 
    onclick="event.stopPropagation();ouvrirFicheEcole('alcools','${ficheEcole.id}')" href="#">
🎓 ${ficheEcole.nom}
  </a>` : '';
})()}

          ${colorant ? '<span class="aacheter-colorant-badge">🎨</span>' : ''}
          ${item.stockBas ? `<span style="background:var(--bg-warning);color:var(--text-warning);border:1px solid var(--border-warning);border-radius:20px;font-size:0.72rem;padding:3px 8px;">⚠️ Stock bas · ${item.pctRestant}%</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          ${prix ? `<span class="item-prix">~${prix}€</span>` : ''}
          ${badgeRecettes}
          <div class="aacheter-score-num">${nbRecettes}</div>
        </div>
      </div>

      <div class="aacheter-indicateurs">
        ${item.gouts?.length ? `<span class="aacheter-indic">🎨 ${item.gouts.slice(0,3).join(' · ')}</span>` : ''}
        ${coutParRecette ? `<span class="aacheter-indic">⚡ ${coutParRecette}€/recette</span>` : ''}
      </div>

<div class="aacheter-recettes-chips">
        ${item.recettesDetail.slice(0, 4).map(r => `
<span class="aacheter-chip">
            <span class="aacheter-chip-nom">${r.nom}</span>
            <span class="aacheter-chip-diff diff-${r.difficulte}">${{facile:'F',moyen:'M',avance:'A'}[r.difficulte]||''}</span>
          </span>
        `).join('')}
        ${item.recettesDetail.length > 4 ? `<span class="aacheter-chip-more">+${item.recettesDetail.length - 4}</span>` : ''}
      </div>

<button class="btn-outline" style="width:100%;margin-top:10px" onclick="marquerAchete('${item.id}', '${item.category_id}', '${item.nom.replace(/'/g, "\\'")}')">
✓ Marquer comme acheté
      </button>
      ${item.stockBas ? `
      <button class="btn-outline" style="width:100%;margin-top:6px;color:var(--text-muted);font-size:0.8rem;" onclick="toggleReapprovisionner('${item.id}', true)">
        🔕 Ne pas réapprovisionner
      </button>` : ''}
    </div>
  `;
}

const REASSIGNATION_CATEGORIES = {
  'a-acheter-spirits':  ['gin', 'vodka', 'whisky', 'mezcal-tequila', 'rhum', 'eaux-de-vie'],
  'a-acheter-liqueurs': ['liqueurs', 'triples-secs', 'vermouth'],
  'a-acheter-vins':     ['bulles'],
  'a-acheter-bitters':  ['bitters'],
  'a-acheter-sirops':   ['sirops', 'ingredients-frais']
};

async function marquerAchete(itemId, catId, nom) {
  if (catId && catId.startsWith('a-acheter-')) {
    ouvrirModalReassignerCategorie(itemId, catId, nom);
    return;
  }
  const { error } = await db.from('items').update({ detenu: true }).eq('id', itemId).eq('user_id', currentUser.id);
  if (error) { alert('Erreur : ' + error.message); return; }
  await chargerCave();
  chargerAAcheter();
}
async function toggleReapprovisionner(itemId, valeur) {
  await db.from('items').update({ ne_pas_reapprovisionner: valeur }).eq('id', itemId).eq('user_id', currentUser.id);
  await chargerCave();
  chargerAAcheter();
}
function ouvrirModalReassignerCategorie(itemId, catId, nom) {
  const cibles = REASSIGNATION_CATEGORIES[catId] || [];
  const optionsHtml = cibles.map(id => {
    const cat = cave.categories.find(c => c.id === id);
    return `<button class="btn-outline" style="width:100%;margin-bottom:8px;text-align:left" onclick="confirmerReassignation('${itemId}','${id}')">${cat?.icon || ''} ${cat?.label || id}</button>`;
  }).join('');

  document.getElementById('reassign-modal-contenu').innerHTML = `
    <h3 style="margin-bottom:4px">Dans quelle catégorie ranger « ${nom} » ?</h3>
    <div class="herbo-latin" style="margin-bottom:16px">Cet item vient de la liste À acheter — indique sa vraie catégorie pour qu'il apparaisse dans Ma Cave.</div>
    ${optionsHtml}
  `;
  afficherModal('modal-reassigner-categorie');
}

async function confirmerReassignation(itemId, nouvelleCategorieId) {
  const { error } = await db.from('items').update({ detenu: true, category_id: nouvelleCategorieId }).eq('id', itemId).eq('user_id', currentUser.id);
  fermerModal('modal-reassigner-categorie');
  if (error) { alert('Erreur : ' + error.message); return; }
  await chargerCave();
  chargerAAcheter();
}

async function chargerApportGustatif() {
  const btn = document.getElementById('btn-apport-gustatif');
  const result = document.getElementById('apport-gustatif-result');
  btn.disabled = true;
  btn.textContent = '⏳ Analyse en cours…';
 
  const caveIds = getItemsCave();
  const { data: allItems } = await db.from('items').select('id, nom, detenu').eq('user_id', currentUser.id);
  const caveNoms = allItems?.filter(i => i.detenu !== false).map(i => i.nom).join(', ') || '';
  const scoreMap = {};
  recettes.forEach(r => {
    (r.ingredients || []).filter(i => i.item_cave_id && !caveIds.has(i.item_cave_id) && !i.optionnel).forEach(ing => {
      scoreMap[ing.nom] = (scoreMap[ing.nom] || 0) + 1;
    });
  });
  const manquantsTop = Object.entries(scoreMap).sort((a,b) => b[1]-a[1]).slice(0,8).map(([nom]) => nom).join(', ');
 
  try {
    const apportResponse = await fetch('/api/apport', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caveNoms, manquantsTop })
    });
    const items = await apportResponse.json();
    result.innerHTML = `
      <div class="apport-liste">
        ${items.map(i => `
          <div class="apport-item">
            <div class="apport-nom">${i.nom}</div>
            <div class="apport-texte">${i.apport}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch(e) {
    result.innerHTML = '<div class="apport-error">Erreur lors de l\'analyse.</div>';
  }
 
  btn.disabled = false;
  btn.textContent = "✨ Rafraîchir l'analyse (Claude)";
}
 
// =============================================
// QR CODE
// =============================================
 
let qrGenerated = false;
 
function toggleQR() {
  const popup = document.getElementById('qr-popup');
  popup.classList.toggle('visible');
 
  if (!qrGenerated && popup.classList.contains('visible')) {
   const url = encodeURIComponent('https://bar-cocktail-smoky.vercel.app');
    const img = document.getElementById('qr-img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&bgcolor=16213e&color=f0e6d3&data=${url}`;
    qrGenerated = true;
  }
}
 
document.addEventListener('click', e => {
  const popup = document.getElementById('qr-popup');
  const btn   = document.getElementById('btn-qr');
  if (popup && !popup.contains(e.target) && e.target !== btn) {
    popup.classList.remove('visible');
  }
});
 
// =============================================
// LANCEMENT
// =============================================
async function chargerDashboard() {
  const container = document.getElementById('dashboard-container');
  if (!container) return;
 
  // Recettes réalisables (cocktails uniquement)
  const realisables = recettes.filter(r => r.type === 'cocktail' && calculerDisponibilite(r) === 0);
 
  // Prix total cave
  const prixTotal = (cave?.categories || []).reduce((sum, cat) =>
    sum + (cat.items || []).filter(i => i.detenu !== false && i.prix_estime)
                   .reduce((s, i) => s + parseFloat(i.prix_estime), 0), 0);
 
  // Conservations urgentes
  const conservations = [];
 (cave?.categories || []).forEach(cat => {
    cat.items.forEach(item => {
      if (item.ouvert && item.conservation) {
        const joursEcoules = Math.floor((Date.now() - new Date(item.date_ouverture || Date.now())) / 86400000);
        const joursMax = item.conservation.duree_mois * 30;
        const joursRestants = Math.round(joursMax - joursEcoules);
        conservations.push({ nom: item.nom, joursRestants });
      }
    });
  });
  conservations.sort((a, b) => a.joursRestants - b.joursRestants);
 
  // Concoctions en cours
  const concEnCours = concoctions.filter(c => c.statut === 'en_cours');
 
  // Anecdote + conseil aléatoires
const [{ data: anecdote }, { data: conseil }, { data: realisations }] = await Promise.all([
    db.from('anecdotes').select('*').limit(50).then(r => ({ data: r.data?.[Math.floor(Math.random() * r.data.length)] })),
    db.from('conseils').select('*').limit(50).then(r => ({ data: r.data?.[Math.floor(Math.random() * r.data.length)] })),
    db.from('realisations').select('*').eq('user_id', currentUser.id).order('date', { ascending: false }).limit(5)
]);

renderDashboard({ realisables, prixTotal, conservations, concEnCours, anecdote, conseil, realisations });
}
 // =============================================
// SESSIONS
// =============================================

function renderDashNavTile(tab, icon, label) {
  return `
    <div class="dash-stat" style="cursor:pointer;align-items:center;justify-content:center;text-align:center;gap:4px"
      onclick="document.querySelector('nav button[data-tab=&quot;${tab}&quot;]').click()">
      <span style="font-size:1.6rem">${icon}</span>
      <span class="dash-stat-label">${label}</span>
    </div>
  `;
}

function renderDashboard({ realisables, prixTotal, conservations, concEnCours, anecdote, conseil, realisations }) {
 const container = document.getElementById('dashboard-container');
  const categorieLabel = { technique: 'Technique', gestion: 'Gestion', service: 'Service' };
  const categorieClass = { technique: 'badge-3', gestion: 'badge-ok', service: 'badge-1' };
 
  const nbConservations = conservations.length;
  const nbConcoctions   = concEnCours.length;
const nbRefs = (cave?.categories || []).reduce((n, c) => n + c.items.filter(i => i.detenu !== false).length, 0); 
  container.innerHTML = `
 
<!-- TUILES STATISTIQUES + RACCOURCIS ONGLETS -->
    <div class="dashboard-grid-top" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      <div class="dash-stat">
        <span class="dash-stat-label">Réalisables maintenant</span>
        <span class="dash-stat-val dash-val-accent">${realisables.length}</span>
        <span class="dash-stat-sub">sur ${recettes.filter(r => r.type === 'cocktail').length} cocktails</span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-label">Concoctions</span>
        <span class="dash-stat-val ${nbConcoctions > 0 ? 'dash-val-warning' : ''}">${nbConcoctions}</span>
        <span class="dash-stat-sub">${nbConcoctions > 0
          ? concEnCours[0].nom + (concEnCours[0].date_fin
            ? ' · ' + Math.ceil((new Date(concEnCours[0].date_fin) - new Date()) / 86400000) + 'j'
            : '')
          : 'aucune en cours'}</span>
      </div>
      ${renderDashNavTile('cave', '🥃', 'Ma Cave')}
      ${renderDashNavTile('recettes', '🍸', 'Recettes')}
      ${renderDashNavTile('sessions', '🎉', 'Sessions')}
      ${renderDashNavTile('herboristerie', '🌿', 'Herboristerie')}
      ${renderDashNavTile('ecole', '🎓', 'École')}
      ${renderDashNavTile('aacheter', '🛒', 'À acheter')}
    </div>
 
    <!-- GRILLE PRINCIPALE -->
    <div class="dashboard-grid-main">
 
      <!-- COLONNE GAUCHE : recettes réalisables -->
      <div class="dash-card">
        <div class="dash-card-header">
          <span class="dash-card-titre">Réalisables ce soir</span>
          <button class="dash-link" onclick="
            document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
            document.querySelector('nav button[data-tab=recettes]').classList.add('active');
            document.getElementById('section-recettes').classList.remove('hidden');
            filtreDisponible = true;
            renderRecettes();
          ">Voir tout</button>
        </div>
        <div class="dash-recettes-liste">
          ${realisables.length === 0
            ? '<div class="dash-empty">Aucun cocktail réalisable avec la cave actuelle.</div>'
            : realisables.slice(0, 5).map(r => `
              <div class="dash-recette-item" onclick="
                document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
                document.querySelector('nav button[data-tab=recettes]').classList.add('active');
                document.getElementById('section-recettes').classList.remove('hidden');
                sectionRecette = 'cocktail';
                ouvrirFicheRecette('${r.id}');
              ">
                ${r.photo_url
                  ? `<img src="${r.photo_url}" alt="${r.nom}" class="dash-recette-img" loading="lazy" onerror="this.style.display='none'">`
                  : `<div class="dash-recette-img dash-recette-img--fallback">${r.nom.charAt(0)}</div>`}
                <div class="dash-recette-info">
                  <div class="dash-recette-nom">${r.nom}</div>
                  <div class="dash-recette-meta">${r.base_alcool ? r.base_alcool + ' · ' : ''}${(r.gouts || []).slice(0, 2).join(' · ')}</div>
                </div>
                <span class="badge-dispo badge-ok">✓</span>
              </div>
            `).join('')}
        </div>
      </div>
 
      <!-- COLONNE DROITE -->
      <div class="dash-col-droite">
 
        ${nbConservations > 0 ? `
        <div class="dash-card">
          <div class="dash-card-titre" style="margin-bottom:10px">Conservations</div>
          ${conservations.slice(0, 4).map(c => {
            const niveau  = c.joursRestants <= 14 ? 'rouge' : c.joursRestants <= 90 ? 'orange' : 'vert';
            const couleur = niveau === 'rouge' ? 'dash-val-danger' : niveau === 'orange' ? 'dash-val-warning' : 'dash-val-ok';
            return `
              <div class="dash-conservation-item">
                <div class="conservation-dot dot-${niveau}"></div>
                <span class="dash-conservation-nom">${c.nom}</span>
                <span class="dash-conservation-delai ${couleur}">${c.joursRestants > 0 ? c.joursRestants + 'j' : 'expiré'}</span>
              </div>`;
          }).join('')}
        </div>` : ''}
 
        <!-- ANECDOTE -->
        <div class="dash-card dash-card--accent">
          <div class="dash-card-header">
            <span class="dash-card-titre">Anecdote du jour</span>
            <button class="dash-refresh-btn" onclick="rechargerAnecdote()" title="Nouvelle anecdote">↻</button>
          </div>
          <p class="dash-anecdote-texte" id="dash-anecdote-texte">${anecdote?.texte || 'Chargement…'}</p>
        </div>
 
        <!-- CONSEIL -->
        <div class="dash-card">
          <div class="dash-card-header">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="dash-card-titre">Conseil du jour</span>
              <span class="badge-dispo ${categorieClass[conseil?.categorie] || 'badge-ok'}" style="font-size:0.68rem;">${categorieLabel[conseil?.categorie] || ''}</span>
            </div>
            <button class="dash-refresh-btn" onclick="rechargerConseil()" title="Nouveau conseil">↻</button>
          </div>
          <p class="dash-conseil-texte" id="dash-conseil-texte">${conseil?.texte || 'Chargement…'}</p>
        </div>
 
</div>
    </div>
    ${renderDashboardRealisations(realisations || [])}
    `;
}

// =============================================
// SESSIONS
// =============================================

async function chargerSessions() {
  const container = document.getElementById('sessions-container');
  if (!container) return;

  const [{ data: sessions }, { data: sessionsOpp }, { data: soireesMenu }] = await Promise.all([
    db.from('sessions_invites')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('is_master', true)
      .order('created_at', { ascending: false }),
    db.from('sessions_opportunite')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false }),
    db.from('soiree_menu')
      .select('*')
      .eq('user_id', currentUser.id)
      .in('statut', ['planification', 'verrouille'])
      .order('created_at', { ascending: false })
  ]);

  renderSessions(sessions || [], sessionsOpp || [], soireesMenu || []);
}

function renderSessions(sessions, sessionsOpp = [], soireesMenu = []) {
  const container = document.getElementById('sessions-container');
  const actives = sessions.filter(s => new Date(s.expires_at) > new Date());
  const passees = sessions.filter(s => new Date(s.expires_at) <= new Date());
  container.innerHTML = `
    <div class="cave-header">
      <h2>🎉 Soirées cocktail</h2>
      <div style="display:flex;gap:8px">
        ${passees.length > 0 ? `<button class="btn-outline" onclick="supprimerSessionsPassees()">🗑️ Vider les passées (${passees.length})</button>` : ''}
        <button class="btn-primary" onclick="ouvrirChoixTypeSession()">+ Nouvelle soirée</button>
      </div>
    </div>
    ${voyageActif ? `
    <div class="section-label">🧳 MODE VOYAGE</div>
    <div style="background:var(--bg-card);border:1px solid var(--border-accent);border-radius:10px;padding:14px;margin-bottom:16px;cursor:pointer" onclick="ouvrirTableauBordVoyage()">
      <div style="font-weight:600">${voyageActif.nom}</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">Actif depuis le ${new Date(voyageActif.date_debut).toLocaleDateString('fr-FR')}</div>
    </div>
    ` : ''}

    ${soireesMenu.length > 0 ? `
    <div class="section-label">🍸 MES SOIRÉES</div>
    ${soireesMenu.map(s => `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"
        onclick="ouvrirTableauBordSoiree('${s.id}')">
        <div>
          <div style="font-weight:600;font-size:0.9rem">${s.nom}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">
            ${s.statut === 'verrouille' ? '🟢 En service' : '🟡 En planification'}
            ${s.voyage_id ? ' · 🧳 Voyage' : ''}
          </div>
        </div>
        <button style="background:none;border:none;color:var(--text-danger);cursor:pointer;font-size:1rem;padding:4px 8px"
          onclick="event.stopPropagation(); supprimerSoireeMenu('${s.id}')">🗑</button>
      </div>
    `).join('')}
    ` : ''}

    ${sessionsOpp.length > 0 ? `
    <div class="section-label">🆘 FIN DU MONDE</div>
    ${sessionsOpp.map(s => renderCarteSessionOpportunite(s)).join('')}
    ` : ''}
    ${actives.length > 0 ? `
    <div class="section-label" style="margin-top:1.5rem">EN COURS</div>
    ${actives.map(s => renderCarteSession(s)).join('')}
    ` : `
    <div class="empty-state">
      <p>Aucune soirée active</p>
    </div>
    `}
    ${passees.length > 0 ? `
    <div class="section-label" style="margin-top:1.5rem">PASSÉES</div>
    ${passees.slice(0, 5).map(s => renderCarteSession(s, true)).join('')}
    ` : ''}
  `;
}

function renderCarteSessionOpportunite(s) {
  return `
    <div class="dash-stat" style="margin-bottom:0.75rem;padding:1rem 1.25rem;cursor:pointer;position:relative"
         onclick="ouvrirSessionOpportuniteDepuisListe('${s.id}')">
      <button style="position:absolute;top:0.75rem;right:0.75rem;width:28px;height:28px;border-radius:8px;background:var(--bg-danger);color:var(--text-danger);border:1px solid var(--border-danger);font-size:0.75rem;cursor:pointer"
        onclick="event.stopPropagation(); supprimerSessionOpportunite('${s.id}')">🗑</button>
      <div style="font-weight:600;font-size:0.9rem">🆘 ${s.nom}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${s.date_soiree ? formatDate(s.date_soiree) : 'sans date'}</div>
    </div>
  `;
}

async function ouvrirSessionOpportuniteDepuisListe(id) {
  if (!document.getElementById('modal-fin-du-monde')) creerModalFinDuMonde();
  afficherModal('modal-fin-du-monde');
  await reprendreSessionOpportunite(id);
}



// =============================================

let finDuMondeSession = null;
let finDuMondeBouteilles = [];

const CUISINE_COMMUNE = [
  'Sucre', 'Sirop simple (maison)', 'Citron jaune', 'Citron vert', 'Glaçons', 'Eau gazeuse', 'Tonic',
  'Miel', 'Sel', 'Poivre', 'Œuf', 'Lait', 'Orange', 'Menthe', 'Cannelle'
];

function ouvrirFinDuMonde() {
  finDuMondeSession = null;
  finDuMondeBouteilles = [];
  if (!document.getElementById('modal-fin-du-monde')) creerModalFinDuMonde();
  renderFinDuMondeAccueil();
  afficherModal('modal-fin-du-monde');
}

async function reprendreSessionOpportunite(id) {
  const { data: session } = await db.from('sessions_opportunite').select('*').eq('id', id).single();
  if (!session) { alert('Session introuvable.'); return; }

  const { data: bouteilles } = await db.from('opportunite_bouteilles')
    .select('*').eq('session_id', id).order('ordre');

  finDuMondeSession = session;
  finDuMondeBouteilles = (bouteilles || []).map(b => ({
    nom: b.nom, categorie_id: b.categorie_id, degre: b.degre, description: b.description
  }));

  renderFinDuMondeBouteilles();
}

async function supprimerSessionOpportunite(id) {
  if (!confirm('Supprimer définitivement cette session et ses bouteilles ?')) return;
  await db.from('sessions_opportunite').delete().eq('id', id).eq('user_id', currentUser.id);
  chargerSessions();
}

function creerModalFinDuMonde() {
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.id = 'modal-fin-du-monde';
  div.innerHTML = `
    <div class="modal modal-large">
      <button class="modal-close" onclick="fermerModal('modal-fin-du-monde')">✕</button>
      <div class="modal-contenu" id="fin-du-monde-contenu"></div>
    </div>
  `;
  document.body.appendChild(div);
}

function renderFinDuMondeAccueil() {
  const zone = document.getElementById('fin-du-monde-contenu');
  zone.innerHTML = `
    <button class="btn-outline" style="margin-bottom:16px" onclick="fermerModal('modal-fin-du-monde')">← Fermer</button>
    <h2 style="margin-bottom:4px">🆘 Soirée Fin du monde</h2>
    <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:16px">
      Tu n'as pas ta cave sous la main — dis-nous ce qu'il y a, on te dit ce que tu peux faire.
    </p>
    <label style="display:block;font-size:0.78rem;color:var(--text-secondary);margin-bottom:6px">Nom de la soirée</label>
    <input type="text" id="fdm-nom" placeholder="Ex : Chez Marc, improvisé" style="margin-bottom:12px">
    <label style="display:block;font-size:0.78rem;color:var(--text-secondary);margin-bottom:6px">Date</label>
    <input type="date" id="fdm-date" value="${new Date().toISOString().split('T')[0]}" style="margin-bottom:16px">
    <button class="btn-primary" style="width:100%" onclick="creerSessionOpportunite()">Continuer →</button>
  `;
}

async function creerSessionOpportunite() {
  const nom = document.getElementById('fdm-nom')?.value?.trim() || 'Session improvisée';
  const date = document.getElementById('fdm-date')?.value || null;
  const id = 'fdm-' + Date.now();

  const { data, error } = await db.from('sessions_opportunite').insert({
    id, user_id: currentUser.id, nom, date_soiree: date, ingredients_cuisine: []
  }).select().single();

  if (error || !data) { alert('Erreur : ' + (error?.message || 'inconnue')); return; }

  finDuMondeSession = data;
  finDuMondeBouteilles = [];
  renderFinDuMondeBouteilles();
}

function renderFinDuMondeBouteilles() {
  const zone = document.getElementById('fin-du-monde-contenu');
  const cuisine = finDuMondeSession.ingredients_cuisine || [];
  zone.innerHTML = `
    <button class="btn-outline" style="margin-bottom:16px" onclick="fermerModal('modal-fin-du-monde')">← Fermer</button>
    <h2 style="margin-bottom:4px">🆘 ${finDuMondeSession.nom}</h2>
    <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:16px">Ajoute les bouteilles trouvées sur place, une par une.</p>

    <div style="display:flex;gap:8px;margin-bottom:12px">
      <input type="text" id="fdm-bouteille-input" placeholder="Ex : Log Cabin whisky" style="flex:1"
        onkeydown="if(event.key==='Enter') identifierBouteilleOpportunite()">
      <button class="btn-primary" id="fdm-identifier-btn" onclick="identifierBouteilleOpportunite()">🔍 Identifier</button>
    </div>
    <div id="fdm-identif-result"></div>

    <div id="fdm-liste-bouteilles" style="margin-top:16px">
      ${renderListeBouteillesOpportunite()}
    </div>

    <div style="margin-top:20px">
      <label style="display:block;font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px">Dans la cuisine, tu as aussi :</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${CUISINE_COMMUNE.map(item => `
          <button onclick="toggleCuisineOpportunite('${item}')"
            style="padding:6px 12px;border-radius:20px;border:1px solid var(--border);background:${cuisine.includes(item) ? 'var(--bg-accent)' : 'var(--bg-card)'};color:${cuisine.includes(item) ? 'var(--text-accent)' : 'var(--text-secondary)'};font-size:0.78rem;cursor:pointer">
            ${cuisine.includes(item) ? '✓ ' : ''}${item}
          </button>
        `).join('')}
      </div>
    </div>

    <button class="btn-primary" style="width:100%;margin-top:20px" onclick="voirRecettesOpportunite()">
      🍸 Voir ce que je peux faire (${finDuMondeBouteilles.length} bouteille${finDuMondeBouteilles.length > 1 ? 's' : ''})
    </button>
  `;
}

function renderListeBouteillesOpportunite() {
  if (!finDuMondeBouteilles.length) return '<div style="font-size:0.8rem;color:var(--text-muted)">Aucune bouteille ajoutée pour l\'instant.</div>';
  return finDuMondeBouteilles.map((b, i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
      <div>
        <div style="font-size:0.85rem;font-weight:600">${b.nom}</div>
        <div style="font-size:0.72rem;color:var(--text-muted)">${b.categorie_id || '?'}${b.degre ? ' · ' + b.degre + '°' : ''}</div>
      </div>
      <button class="btn-icon" onclick="retirerBouteilleOpportunite(${i})" title="Retirer">🗑</button>
    </div>
  `).join('');
}

async function identifierBouteilleOpportunite() {
  const input = document.getElementById('fdm-bouteille-input');
  const nom = input?.value?.trim();
  if (!nom) return;

  const btn = document.getElementById('fdm-identifier-btn');
  const result = document.getElementById('fdm-identif-result');
  btn.disabled = true;
  btn.textContent = '⏳';
  result.innerHTML = '';

  try {
    const res = await fetch('/api/identifier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom })
    });
    const info = await res.json();

    let bouteille;
    if (!info.identifie) {
      result.innerHTML = `<div style="font-size:0.8rem;color:var(--text-warning);margin-bottom:8px">❓ Non identifié précisément — ajouté tel quel.</div>`;
      bouteille = { nom, categorie_id: null, degre: null, description: null };
    } else {
      bouteille = { nom, categorie_id: info.categorie_id || null, degre: info.degre || null, description: info.description || null };
    }
    finDuMondeBouteilles.push(bouteille);

    await db.from('opportunite_bouteilles').insert({
      session_id: finDuMondeSession.id,
      user_id: currentUser.id,
      nom: bouteille.nom,
      categorie_id: bouteille.categorie_id,
      degre: bouteille.degre,
      description: bouteille.description,
      ordre: finDuMondeBouteilles.length
    });

    input.value = '';
    renderFinDuMondeBouteilles();
  } catch (e) {
    result.innerHTML = `<div style="font-size:0.8rem;color:var(--text-danger)">Erreur réseau, réessaie.</div>`;
  }

  btn.disabled = false;
  btn.textContent = '🔍 Identifier';
}

function retirerBouteilleOpportunite(index) {
  finDuMondeBouteilles.splice(index, 1);
  renderFinDuMondeBouteilles();
  db.from('opportunite_bouteilles').delete().eq('session_id', finDuMondeSession.id).then(() => {
    if (finDuMondeBouteilles.length) {
      db.from('opportunite_bouteilles').insert(
        finDuMondeBouteilles.map((b, i) => ({
          session_id: finDuMondeSession.id, user_id: currentUser.id,
          nom: b.nom, categorie_id: b.categorie_id, degre: b.degre, description: b.description, ordre: i + 1
        }))
      );
    }
  });
}

async function toggleCuisineOpportunite(item) {
  const liste = finDuMondeSession.ingredients_cuisine || [];
  const idx = liste.indexOf(item);
  if (idx === -1) liste.push(item); else liste.splice(idx, 1);
  finDuMondeSession.ingredients_cuisine = liste;

  await db.from('sessions_opportunite').update({ ingredients_cuisine: liste }).eq('id', finDuMondeSession.id);
  renderFinDuMondeBouteilles();
}

function voirRecettesOpportunite() {
  const dispoTextes = [
    ...finDuMondeBouteilles.map(b => (b.nom || '').toLowerCase()),
    ...finDuMondeBouteilles.map(b => (b.categorie_id || '').toLowerCase()),
    ...(finDuMondeSession.ingredients_cuisine || []).map(c => c.toLowerCase())
  ].filter(Boolean);

  // Synonymes connus : plusieurs recettes désignent le même ingrédient avec des mots différents.
  if (dispoTextes.some(d => d.includes('sirop simple') || d.includes('sirop de sucre'))) {
    dispoTextes.push('sirop simple', 'sirop de sucre');
  }

  const realisables = recettes
    .filter(r => r.type === 'cocktail' && (r.ingredients || []).length > 0)
    .map(r => {
      const ingredientsRequis = (r.ingredients || []).filter(i => !i.optionnel);
      const manquantsListe = ingredientsRequis.filter(ing => {
        const key = (ing.nom || '').toLowerCase();
        return !dispoTextes.some(d => key.includes(d) || d.includes(key));
      });
      return { r, manquants: manquantsListe.length, nomsManquants: manquantsListe.map(i => i.nom) };
    })
    .sort((a, b) => a.manquants - b.manquants)
    .slice(0, 20);

  const zone = document.getElementById('fin-du-monde-contenu');
  zone.innerHTML = `
    <h2 style="margin-bottom:4px">🍸 ${finDuMondeSession.nom} — ce que tu peux faire</h2>
    <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:16px">Classé par nombre d'ingrédients manquants — le matching est approximatif (texte), à vérifier au moment de préparer.</p>

    <button class="btn-outline" style="margin-bottom:16px" onclick="renderFinDuMondeBouteilles()">← Retour aux bouteilles</button>

    ${realisables.map(({ r, manquants, nomsManquants }) => `
      <div class="dash-stat" style="margin-bottom:0.6rem;padding:0.85rem 1rem">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:600;font-size:0.9rem">${r.nom}</div>
          ${badgeDisponibilite(manquants)}
        </div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px">${(r.ingredients || []).map(i => `<span style="${nomsManquants.includes(i.nom) ? 'color:var(--text-danger);font-weight:600' : ''}">${i.nom}</span>`).join(' · ')}</div>
      </div>
    `).join('')}
  `;
}
function renderCarteSession(s, passee = false) {
  const nbInvites = 0; // sera enrichi avec invités réels
  const expires = new Date(s.expires_at);
  const heuresRestantes = Math.max(0, Math.ceil((expires - new Date()) / 3600000));

  return `
    <div class="dash-stat" style="margin-bottom:0.75rem;padding:1rem 1.25rem;cursor:${passee ? 'default' : 'pointer'};position:relative"
         ${!passee ? `onclick="ouvrirSession('${s.id}')"` : ''}>
      <button style="position:absolute;top:0.75rem;right:0.75rem;width:28px;height:28px;border-radius:8px;background:var(--bg-danger);color:var(--text-danger);border:1px solid var(--border-danger);font-size:0.75rem;cursor:pointer"
        onclick="event.stopPropagation(); supprimerSession('${s.id}', '${s.nom_session}')">✕</button>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;padding-right:32px">
        <span style="font-weight:600;font-size:1rem">${s.nom_session || 'Soirée sans nom'}</span>
        ${!passee
          ? `<span class="badge badge-ok">${heuresRestantes}h restantes</span>`
          : `<span class="badge badge-3">Terminée</span>`}
      </div>
      <div style="font-size:0.8rem;opacity:0.6">
        Mode : ${s.mode_choix === 'verrouille' ? '🔒 Verrouillé' : '🔓 Libre'} · 
        ${s.recettes_disponibles?.length || 0} recette(s) · 
        ${passee ? new Date(s.created_at).toLocaleDateString('fr-FR') : heuresRestantes + 'h restantes'}
      </div>
    </div>
  `;
}

async function supprimerSession(id, nomSession) {
  if (!confirm(`Supprimer la session "${nomSession || 'sans nom'}" et tous ses invités ? Cette action est irréversible.`)) return;

  const { error } = await db.from('sessions_invites').delete().eq('nom_session', nomSession);
  if (error) { alert('Erreur suppression : ' + error.message); return; }

  chargerSessions();
}

async function supprimerSessionsPassees() {
  if (!confirm('Supprimer toutes les sessions passées (et leurs invités) ? Cette action est irréversible.')) return;

  const { data: sessions } = await db.from('sessions_invites')
    .select('nom_session')
    .eq('user_id', currentUser.id)
    .eq('is_master', true)
    .lte('expires_at', new Date().toISOString());

  const nomsAsupprimer = [...new Set((sessions || []).map(s => s.nom_session))];
  if (nomsAsupprimer.length === 0) { chargerSessions(); return; }

  const { error } = await db.from('sessions_invites').delete().in('nom_session', nomsAsupprimer);
  if (error) { alert('Erreur suppression : ' + error.message); return; }

  chargerSessions();
}
let modeSessionActif = 'libre';
let quizActif = true;

function setQuizActif(actif) {
  quizActif = actif;
  document.getElementById('btn-quiz-oui').classList.toggle('active', actif);
  document.getElementById('btn-quiz-non').classList.toggle('active', !actif);
}
function setModeSession(mode) {
  modeSessionActif = mode;
  document.getElementById('btn-mode-libre').classList.toggle('active', mode === 'libre');
  document.getElementById('btn-mode-verrouille').classList.toggle('active', mode === 'verrouille');
  const blocRecettes = document.getElementById('bloc-recettes-liste');
  if (blocRecettes) blocRecettes.style.display = mode === 'libre' ? 'none' : '';
}
function ouvrirChoixTypeSession() {
  // Récupère automatiquement toute sélection de recettes en attente,
  // peu importe le bouton "+ Nouvelle soirée" utilisé pour arriver ici
  if (recettesSelectionneesSoiree.size > 0) {
    selectionPourSoireeEnAttente = Array.from(recettesSelectionneesSoiree);
  }
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:24px;max-width:380px;width:100%">
      <div style="font-size:1.05rem;font-weight:700;margin-bottom:4px">🎉 Nouvelle soirée</div>
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:18px">Quel type de session ?</div>

      <button class="btn-outline" style="width:100%;padding:14px;margin-bottom:10px;text-align:left;display:flex;align-items:center;gap:12px"
        onclick="this.closest('div[style*=fixed]').remove(); ouvrirModalNouvelleSession()">
        <span style="font-size:1.4rem">🎉</span>
        <span>
          <div style="font-weight:600">Soirée programmée</div>
          <div style="font-size:0.75rem;color:var(--text-muted);font-weight:400">QR code, invités, choix de cocktails</div>
        </span>
      </button>

      <button class="btn-outline" style="width:100%;padding:14px;margin-bottom:20px;text-align:left;display:flex;align-items:center;gap:12px"
       onclick="this.closest('div[style*=fixed]').remove(); creerSoireeMenuSolo(voyageActif?.id || null)">
        <span style="font-size:1.4rem">🧑‍🍳</span>
<span>
          <div style="font-weight:600">Je sers moi-même</div>
          <div style="font-size:0.75rem;color:var(--text-muted);font-weight:400">Batch imposé, tableau de bord de stock</div>
        </span>
      </button>

      <div style="border-top:1px dashed var(--border);margin-bottom:16px"></div>

      <button class="btn-outline" style="width:100%;padding:14px;margin-bottom:16px;text-align:left;display:flex;align-items:center;gap:12px"
        onclick="this.closest('div[style*=fixed]').remove(); ouvrirFinDuMonde()">
        <span style="font-size:1.4rem">🆘</span>
        <span>
          <div style="font-weight:600">Fin du monde</div>
          <div style="font-size:0.75rem;color:var(--text-muted);font-weight:400">Cave d'opportunité, identification bouteilles</div>
        </span>
      </button>

      <button class="btn-outline" style="width:100%;padding:10px" onclick="this.closest('div[style*=fixed]').remove()">Annuler</button>
    </div>
  `;
  document.body.appendChild(modal);
}
async function creerSoireeMenuSolo(voyageId = null) {
  if (voyageId) {
    // Depuis le voyage : choix de type simplifié
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:24px';
    modal.innerHTML = `
      <div style="background:var(--bg-card);border-radius:16px;padding:24px;max-width:380px;width:100%">
        <div style="font-size:1.05rem;font-weight:700;margin-bottom:4px">🧳 Nouvelle soirée voyage</div>
        <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:18px">Quel type de soirée ?</div>
        <button class="btn-outline" style="width:100%;padding:14px;margin-bottom:10px;text-align:left;display:flex;align-items:center;gap:12px"
          onclick="this.closest('div[style*=fixed]').remove(); ouvrirModalNouvelleSession('${voyageId}')">
          <span style="font-size:1.4rem">🎉</span>
          <span>
            <div style="font-weight:600">Soirée programmée</div>
            <div style="font-size:0.75rem;color:var(--text-muted);font-weight:400">QR code, invités, choix de cocktails</div>
          </span>
        </button>
        <button class="btn-outline" style="width:100%;padding:14px;margin-bottom:20px;text-align:left;display:flex;align-items:center;gap:12px"
          onclick="this.closest('div[style*=fixed]').remove(); creerSoireeVoyageSolo('${voyageId}')">
          <span style="font-size:1.4rem">🧑‍🍳</span>
          <span>
            <div style="font-weight:600">Je sers moi-même</div>
            <div style="font-size:0.75rem;color:var(--text-muted);font-weight:400">Batch imposé, tableau de bord de stock</div>
          </span>
        </button>
        <button class="btn-outline" style="width:100%;padding:10px" onclick="this.closest('div[style*=fixed]').remove(); ouvrirTableauBordVoyage()">Annuler</button>
      </div>
    `;
    document.body.appendChild(modal);
    return;
  }

  // Hors voyage : comportement original
  const id = 'soiree-' + Date.now();
  const { data, error } = await db.from('soiree_menu').insert({
    id,
    user_id: currentUser.id,
    nom: prompt('Nom de la soirée ?', 'Soirée du ' + new Date().toLocaleDateString('fr-FR')) || 'Ma soirée',
    mode: 'solo'
  }).select().single();
  if (error) { alert('Erreur : ' + error.message); return; }

  if (selectionPourSoireeEnAttente) {
    for (const recetteId of selectionPourSoireeEnAttente) {
      await db.from('soiree_menu_recettes').insert({
        id: 'smr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        soiree_menu_id: id, recette_id: recetteId, portions_prevues: 6, ordre: 0
      });
    }
    selectionPourSoireeEnAttente = null;
  }

  ouvrirTableauBordSoiree(id);
}

async function creerSoireeVoyageSolo(voyageId) {
  const nom = prompt('Nom de la soirée ?', 'Soirée 1');
  if (!nom) return;
  const id = 'soiree-' + Date.now();
  const { data, error } = await db.from('soiree_menu').insert({
    id,
    user_id: currentUser.id,
    nom,
    mode: 'solo',
    voyage_id: voyageId
  }).select().single();
  if (error) { alert('Erreur : ' + error.message); return; }
  ouvrirTableauBordSoiree(id);
}
async function supprimerSoireeVoyage(soireeId) {
  if (!confirm('Supprimer cette soirée ?')) return;
  await db.from('soiree_menu_recettes').delete().eq('soiree_menu_id', soireeId);
  await db.from('soiree_menu').delete().eq('id', soireeId);
  ouvrirTableauBordVoyage();
}
async function ouvrirBilanVoyage() {
  if (!voyageActif) return;

  const { data: bouteilles } = await db.from('mode_voyage_bouteilles').select('*').eq('mode_voyage_id', voyageActif.id);

  const modal = document.createElement('div');
  modal.id = 'modal-bilan-voyage';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9500;overflow-y:auto;padding:20px';

  const lignes = (bouteilles || []).map(b => {
    const clRestant = parseFloat(b.cl_restants_voyage ?? 0);
    const clOrigine = parseFloat(b.cl_restants_origine ?? clRestant);
    const consomme = Math.max(0, clOrigine - clRestant);
    return { b, clRestant, clOrigine, consomme };
  });

window._bilanVoyageLignes = lignes.map((l, idx) => ({ itemId: l.b.item_cave_id, idx }));

modal.innerHTML = `
    <div style="max-width:600px;margin:0 auto;background:var(--bg-card);border-radius:16px;padding:20px">
      <div style="font-size:1.1rem;font-weight:700;color:var(--accent);margin-bottom:4px">🏁 Bilan du voyage — ${voyageActif.nom}</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:16px">Vérifie et ajuste les quantités consommées avant d'appliquer à ta cave.</div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
        <button class="btn-primary" style="width:100%;padding:12px" 
          onclick="appliquerBilanVoyage(window._bilanVoyageLignes)">
          ✅ Appliquer à ma cave et terminer
        </button>
        <button class="btn-outline" style="width:100%;padding:12px" 
          onclick="document.getElementById('modal-bilan-voyage').remove(); ouvrirDecrementationParCocktail()">
          🍸 Décrémenter par cocktail puis terminer
        </button>
        <button class="btn-outline" style="width:100%;padding:10px;color:var(--text-muted)" 
          onclick="document.getElementById('modal-bilan-voyage').remove()">
          Annuler — continuer le voyage
        </button>
      </div>

      <div style="font-size:0.85rem;font-weight:600;margin-bottom:10px">🍾 Bouteilles</div>
      ${lignes.map((l, idx) => `
        <div style="padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:0.9rem;font-weight:600">${l.b.nom}</span>
            <span style="font-size:0.75rem;color:var(--text-muted)">Départ : ${l.clOrigine} cl</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:0.82rem;color:var(--text-secondary);min-width:100px">Restant après voyage :</span>
            <input type="number" id="bilan-cl-${idx}" value="${l.clRestant}" min="0" max="${l.clOrigine}" step="0.5"
              style="width:80px;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.9rem">
            <span style="font-size:0.78rem;color:var(--text-muted)">cl</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  document.body.appendChild(modal);
}
async function ouvrirDecrementationParCocktail() {
  const modal = document.createElement('div');
  modal.id = 'modal-decrement-cocktail';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9600;overflow-y:auto;padding:20px';

  window._decrementRecettes = recettes;
  window._decrementRows = [];
  window._decrementSection = 'cocktail';
  window._decrementSearch = '';

  modal.innerHTML = `
    <div style="max-width:500px;margin:0 auto;background:var(--bg-card);border-radius:16px;padding:20px">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px">🍸 Décrémenter par cocktail</div>
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:16px">
        Sélectionne chaque cocktail réalisé et le nombre de portions.
      </div>
      <div id="decrement-rows" style="margin-bottom:12px"></div>
      <div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button id="dec-tab-cocktail" style="flex:1;font-size:0.78rem;padding:6px;border-radius:6px;border:1px solid var(--border-accent);background:var(--bg-accent);color:var(--text-accent);cursor:pointer"
            onclick="window._decrementSection='cocktail'; renderDecrementPicker()">🍸 Cocktails</button>
          <button id="dec-tab-mocktail" style="flex:1;font-size:0.78rem;padding:6px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text-primary);cursor:pointer"
            onclick="window._decrementSection='mocktail'; renderDecrementPicker()">🥤 Mocktails</button>
          <button id="dec-tab-preparation" style="flex:1;font-size:0.78rem;padding:6px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text-primary);cursor:pointer"
            onclick="window._decrementSection='preparation'; renderDecrementPicker()">⚗️ Prép.</button>
        </div>
        <input type="text" placeholder="Rechercher..." id="dec-search"
          style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;margin-bottom:8px"
          oninput="window._decrementSearch=this.value; renderDecrementPicker()">
        <div id="dec-picker" style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:4px"></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-outline" style="flex:1" onclick="document.getElementById('modal-decrement-cocktail').remove(); ouvrirBilanVoyage()">← Retour</button>
        <button class="btn-primary" style="flex:1" onclick="appliquerDecrementParCocktail()">✅ Appliquer et terminer</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  renderDecrementPicker();
}

function renderDecrementPicker() {
  const picker = document.getElementById('dec-picker');
  if (!picker) return;
  ['cocktail','mocktail','preparation'].forEach(s => {
    const btn = document.getElementById(`dec-tab-${s}`);
    if (!btn) return;
    const actif = window._decrementSection === s;
    btn.style.background = actif ? 'var(--bg-accent)' : 'none';
    btn.style.color = actif ? 'var(--text-accent)' : 'var(--text-primary)';
    btn.style.borderColor = actif ? 'var(--border-accent)' : 'var(--border)';
  });
  const q = (window._decrementSearch || '').toLowerCase();
  const liste = (window._decrementRecettes || [])
    .filter(r => r.type === window._decrementSection)
    .filter(r => !q || r.nom.toLowerCase().includes(q));
  picker.innerHTML = liste.map(r => `
    <div style="padding:8px 10px;border-radius:6px;cursor:pointer;font-size:0.85rem;border:1px solid var(--border)"
      onmouseover="this.style.background='var(--bg-card-hover)'"
      onmouseout="this.style.background=''"
      onclick="ajouterLigneDecrement('${r.id}', '${r.nom.replace(/'/g, "\\'")}')">
      ${r.nom}
    </div>
  `).join('') || '<div style="font-size:0.8rem;color:var(--text-muted)">Aucune recette trouvée.</div>';
}

function ajouterLigneDecrement(recetteId, recetteNom) {
  if (!recetteId) return;
  const rows = document.getElementById('decrement-rows');
  if (!rows) return;
  const idx = Date.now();
  const recette = recettes.find(r => r.id === recetteId);
  const subs = {};
  (recette?.ingredients || []).forEach(ing => {
    if (ing.item_cave_id) subs[ing.item_cave_id] = ing.item_cave_id;
  });
  window._decrementRows.push({ recetteId, portions: 1, idx, subs });
  const ingsTrackables = (recette?.ingredients || []).filter(ing =>
    ing.item_cave_id && ing.quantite &&
    (ing.unite === 'cl' || ing.unite === 'ml') &&
    !ing.optionnel &&
    !CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))
  );
  const bouteillesVoyage = voyageActif
    ? voyageBouteillesActives
    : cave?.categories?.flatMap(c => c.items).filter(i => i.detenu !== false) || [];
  const div = document.createElement('div');
  div.id = `decrement-row-${idx}`;
  div.style.cssText = 'padding:10px;border-radius:8px;border:1px solid var(--border);margin-bottom:8px';
  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:0.88rem;font-weight:600">${recetteNom}</span>
      <div style="display:flex;align-items:center;gap:6px">
        <button style="background:none;border:1px solid var(--border);border-radius:4px;width:24px;height:24px;cursor:pointer;color:var(--text-primary)"
          onclick="window._decrementRows.find(r=>r.idx===${idx}).portions=Math.max(1,window._decrementRows.find(r=>r.idx===${idx}).portions-1); document.getElementById('dec-qty-${idx}').textContent=window._decrementRows.find(r=>r.idx===${idx}).portions">−</button>
        <span id="dec-qty-${idx}" style="min-width:20px;text-align:center;font-size:0.9rem">1</span>
        <button style="background:none;border:1px solid var(--border);border-radius:4px;width:24px;height:24px;cursor:pointer;color:var(--text-primary)"
          onclick="window._decrementRows.find(r=>r.idx===${idx}).portions++; document.getElementById('dec-qty-${idx}').textContent=window._decrementRows.find(r=>r.idx===${idx}).portions">+</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">v.</span>
        <button style="background:none;border:none;color:var(--text-danger);cursor:pointer;font-size:1rem;margin-left:4px"
          onclick="document.getElementById('decrement-row-${idx}').remove(); window._decrementRows=window._decrementRows.filter(r=>r.idx!==${idx})">🗑</button>
      </div>
    </div>
    ${ingsTrackables.map(ing => {
      const nomItem = voyageActif
        ? (bouteillesVoyage.find(b => b.item_cave_id === ing.item_cave_id)?.nom || ing.nom)
        : (cave?.categories?.flatMap(c => c.items).find(i => i.id === ing.item_cave_id)?.nom || ing.nom);
      const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:0.8rem;border-top:1px solid var(--border)">
          <select style="flex:1;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.78rem;margin-right:8px"
            onchange="window._decrementRows.find(r=>r.idx===${idx}).subs['${ing.item_cave_id}']=this.value">
            ${bouteillesVoyage.map(b => {
              const bId = voyageActif ? b.item_cave_id : b.id;
              const bNom = b.nom;
              return `<option value="${bId}" ${bId === ing.item_cave_id ? 'selected' : ''}>${bNom}</option>`;
            }).join('')}
          </select>
          <span style="color:var(--text-muted);white-space:nowrap">${qteCl}cl</span>
        </div>
      `;
    }).join('')}
  `;
  rows.appendChild(div);
  const search = document.getElementById('dec-search');
  if (search) { search.value = ''; window._decrementSearch = ''; renderDecrementPicker(); }
}



async function appliquerDecrementParCocktail() {
  // Recharge les bouteilles voyage fraîches avant de décrémenter (évite un tableau périmé en mémoire)
  if (voyageActif) {
    const { data: bouteillesFraiches } = await db.from('mode_voyage_bouteilles').select('*').eq('mode_voyage_id', voyageActif.id);
    voyageBouteillesActives = bouteillesFraiches || [];
  }
  const conso = {};
  for (const row of window._decrementRows) {
    if (!row.recetteId) continue;
    const recette = recettes.find(r => r.id === row.recetteId);
    if (!recette) continue;
    (recette.ingredients || []).forEach(ing => {
      if (!ing.item_cave_id || !ing.quantite || ing.optionnel) return;
      if (ing.unite !== 'cl' && ing.unite !== 'ml') return;
      if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) return;
      const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
      const itemId = (row.subs && row.subs[ing.item_cave_id]) || ing.item_cave_id;
      conso[itemId] = (conso[itemId] || 0) + qteCl * row.portions;
    });
  }
  for (const [itemId, cl] of Object.entries(conso)) {
    if (voyageActif) {
      const bouteille = voyageBouteillesActives.find(b => b.item_cave_id === itemId);
      if (!bouteille) continue;
      const nouveau = Math.max(0, parseFloat(bouteille.cl_restants_voyage ?? 0) - cl);
      await db.from('mode_voyage_bouteilles')
        .update({ cl_restants_voyage: nouveau })
        .eq('item_cave_id', itemId)
        .eq('mode_voyage_id', voyageActif.id);
      bouteille.cl_restants_voyage = nouveau;
    } else {
      const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === itemId);
      if (!item) continue;
      const nouveau = Math.max(0, (item.cl_restants ?? 0) - cl);
      await db.from('items').update({ cl_restants: nouveau }).eq('id', itemId).eq('user_id', currentUser.id);
      item.cl_restants = nouveau;
    }
  }
  document.getElementById('modal-decrement-cocktail')?.remove();
  ouvrirBilanVoyage();
}
async function appliquerBilanVoyage(lignesRef) {
  for (const { itemId, idx } of lignesRef) {
    if (!itemId) continue;
    const input = document.getElementById('bilan-cl-' + idx);
    if (!input) continue;
    const nouveauCl = parseFloat(input.value);
    if (isNaN(nouveauCl)) continue;
    await db.from('items').update({ cl_restants: nouveauCl })
      .eq('id', itemId).eq('user_id', currentUser.id);
  }

  // Clôturer le voyage
  await db.from('mode_voyage').update({ statut: 'termine' })
    .eq('id', voyageActif.id).eq('user_id', currentUser.id);

  voyageActif = null;
  voyageBouteillesActives = [];
  document.getElementById('modal-bilan-voyage')?.remove();
  document.getElementById('modal-tableau-bord-voyage')?.remove();
  renderBandeauVoyageGlobal();
  chargerCave();
  alert('Voyage terminé — ta cave a été mise à jour.');
}
let soireeMenuActive = null;
let soireeMenuRecettesActives = [];

async function ouvrirTableauBordSoiree(soireeMenuId) {
  const { data: menu } = await db.from('soiree_menu').select('*').eq('id', soireeMenuId).single();
  const { data: menuRecettes } = await db.from('soiree_menu_recettes').select('*').eq('soiree_menu_id', soireeMenuId).order('ordre');

  soireeMenuActive = menu;
  soireeMenuRecettesActives = menuRecettes || [];

  let modal = document.getElementById('modal-tableau-bord-soiree');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-tableau-bord-soiree';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9000;overflow-y:auto;padding:20px';
    document.body.appendChild(modal);
  }

  // Vérifier contenances manquantes
  const ingsSansContenance = [];
  soireeMenuRecettesActives.forEach(mr => {
    const recette = recettes.find(r => r.id === mr.recette_id);
    (recette?.ingredients || []).forEach(ing => {
      if (!ing.item_cave_id || ing.optionnel) return;
      if (ing.unite !== 'cl' && ing.unite !== 'ml') return;
      if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) return;
      const item = voyageActif
        ? voyageBouteillesActives.find(b => b.item_cave_id === ing.item_cave_id)
        : cave?.categories?.flatMap(c => c.items).find(i => i.id === ing.item_cave_id);
      const clRestants = voyageActif ? item?.cl_restants_voyage : item?.cl_restants;
      if (item && (clRestants === null || clRestants === undefined) && !ingsSansContenance.some(i => i.itemId === ing.item_cave_id)) {
        ingsSansContenance.push({ itemId: ing.item_cave_id, nom: item?.nom || ing.nom });
      }
    });
  });

  if (ingsSansContenance.length > 0) {
    modal.innerHTML = `
      <div style="max-width:500px;margin:40px auto;background:var(--bg-card);border-radius:16px;padding:20px">
        <div style="font-size:1rem;font-weight:700;margin-bottom:4px">⚠️ Contenances manquantes</div>
        <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:16px">
          Renseigne les quantités disponibles pour un suivi précis.
        </div>
        ${ingsSansContenance.map(i => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:0.88rem;font-weight:600">${i.nom}</span>
            <div style="display:flex;align-items:center;gap:6px">
              <input type="number" id="cl-${i.itemId}" placeholder="cl" min="0" step="0.5"
                style="width:70px;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.9rem;text-align:right">
              <span style="font-size:0.82rem;color:var(--text-muted)">cl</span>
            </div>
          </div>
        `).join('')}
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn-outline" style="flex:1" onclick="renderTableauBordSoiree()">Passer</button>
          <button class="btn-primary" style="flex:1" onclick="validerContenancesManquantes(${JSON.stringify(ingsSansContenance.map(i => i.itemId))})">
            ✅ Valider et continuer
          </button>
        </div>
      </div>
    `;
    return;
  }

  await renderTableauBordSoiree();
}

async function validerContenancesManquantes(itemIds) {
  for (const itemId of itemIds) {
    const input = document.getElementById('cl-' + itemId);
    if (!input || !input.value) continue;
    const cl = parseFloat(input.value);
    if (isNaN(cl)) continue;

    if (voyageActif) {
      await db.from('mode_voyage_bouteilles')
        .update({ cl_restants_voyage: cl })
        .eq('item_cave_id', itemId)
        .eq('mode_voyage_id', voyageActif.id);
      const b = voyageBouteillesActives.find(b => b.item_cave_id === itemId);
      if (b) b.cl_restants_voyage = cl;
    } else {
      await db.from('items')
        .update({ cl_restants: cl })
        .eq('id', itemId)
        .eq('user_id', currentUser.id);
      const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === itemId);
      if (item) item.cl_restants = cl;
    }
  }
  renderTableauBordSoiree();
}
function calculerConsommationAgregee() {
  // Pour chaque item_cave_id apparaissant dans au moins une recette du menu,
  // additionne la consommation projetée sur toutes les recettes qui l'utilisent.
  const conso = {};

  soireeMenuRecettesActives.forEach(mr => {
    const recette = recettes.find(r => r.id === mr.recette_id);
    if (!recette) return;
(recette.ingredients || []).forEach(ing => {
      if (!ing.item_cave_id || !ing.quantite || ing.optionnel) return;
      if (ing.unite !== 'cl' && ing.unite !== 'ml') return;
      if (/glace|glaçon/i.test(ing.nom || '')) return;
      if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) return;
      const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
      if (!conso[ing.item_cave_id]) conso[ing.item_cave_id] = { nom: ing.nom, totalCl: 0 };
      conso[ing.item_cave_id].totalCl += qteCl * mr.portions_prevues;
    });
  });

  return Object.entries(conso).map(([itemId, c]) => {
const item = voyageActif
  ? voyageBouteillesActives.find(b => b.item_cave_id === itemId)
  : cave?.categories?.flatMap(cat => cat.items).find(i => i.id === itemId);
const disponibleReel = voyageActif
  ? (item ? Math.max(0, parseFloat(item.cl_restants_voyage ?? 0)) : null)
  : (item ? Math.max(0, item.cl_restants - clReserveePour(itemId)) : null);
return {
      itemId,
      nomItem: item?.nom || c.nom,
      besoinCl: Math.round(c.totalCl * 10) / 10,
      disponibleReel,
      inconnu: voyageActif ? (!item || item.cl_restants_voyage === null) : (!item || item.cl_restants === null),
      suffisant: disponibleReel !== null ? disponibleReel >= c.totalCl : null
    };
  });
}

async function renderTableauBordSoiree() {
  const modal = document.getElementById('modal-tableau-bord-soiree');
  if (!modal) return;

  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;

  // Charger les services déjà effectués
  const { data: services } = await db.from('soiree_services')
    .select('*')
    .eq('soiree_menu_id', soireeMenuActive.id);
 

  // Charger les invités
  const { data: invites } = await db.from('sessions_invites')
    .select('*')
    .eq('soiree_menu_id', soireeMenuActive.id)
    .eq('is_master', false)
    .order('created_at');
 // Créer automatiquement les lignes soiree_services pour les invités qui ont choisi via QR
  for (const inv of (invites || [])) {
    if (!inv.recette_id) continue;
    const dejaService = (services || []).some(s => 
      s.invite_id === inv.id && s.recette_id === inv.recette_id
    );
    if (!dejaService) {
      const { data: newService } = await db.from('soiree_services').insert({
        id: 'srv-qr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        user_id: currentUser.id,
        soiree_menu_id: soireeMenuActive.id,
        recette_id: inv.recette_id,
        portions: 1,
        item_cave_id: inv.recette_id,
        cl_servi: 0,
        statut: 'assigne',
        invite_id: inv.id
      }).select().single();
      if (newService) services.push(newService);
    }
  }
// Grouper les services par invite_id
const servicesParInvite = {};
  (services || []).forEach(s => {
    if (!s.invite_id) return;
    if (!servicesParInvite[s.invite_id]) servicesParInvite[s.invite_id] = [];
    // Fusionner assigne+servi pour la même ligne (même id)
    const existing = servicesParInvite[s.invite_id].find(x => x.id === s.id);
    if (!existing) servicesParInvite[s.invite_id].push(s);
  });
  // Calculer consommation projetée par item
const consoPrevue = {};
  soireeMenuRecettesActives.forEach(mr => {
    const recette = recettes.find(r => r.id === mr.recette_id);
    const servicesRecette = (services || []).filter(s => 
      s.recette_id === mr.recette_id && 
      s.statut === 'assigne' && 
      s.soiree_menu_id === soireeMenuActive.id
    );
    
    if (servicesRecette.length > 0) {
      // Calculer par service avec ses substitutions propres
      servicesRecette.forEach(s => {
        const subs = s.substitutions || {};
        (recette?.ingredients || []).forEach(ing => {
          if (!ing.item_cave_id || !ing.quantite || ing.optionnel) return;
          if (ing.unite !== 'cl' && ing.unite !== 'ml') return;
          if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) return;
          const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
          const itemId = subs[ing.item_cave_id] || ing.item_cave_id;
          if (!consoPrevue[itemId]) consoPrevue[itemId] = { nom: ing.nom, totalCl: 0 };
          consoPrevue[itemId].totalCl += qteCl;
        });
      });
    } else {
      // Pas de service assigné — utiliser portions_prevues sans substitution
      (recette?.ingredients || []).forEach(ing => {
        if (!ing.item_cave_id || !ing.quantite || ing.optionnel) return;
        if (ing.unite !== 'cl' && ing.unite !== 'ml') return;
        if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) return;
        const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
        if (!consoPrevue[ing.item_cave_id]) consoPrevue[ing.item_cave_id] = { nom: ing.nom, totalCl: 0 };
        consoPrevue[ing.item_cave_id].totalCl += qteCl * mr.portions_prevues;
      });
    }
  });

// Calculer consommation réelle par item depuis les services "servi"
const consoReelle = {};
  (services || []).filter(s => s.statut === 'servi' && s.soiree_menu_id === soireeMenuActive.id).forEach(s => {
    if (parseFloat(s.cl_servi || 0) > 0) {
      consoReelle[s.item_cave_id] = (consoReelle[s.item_cave_id] || 0) + parseFloat(s.cl_servi);
    } else {
      const recette = recettes.find(r => r.id === s.recette_id);
      const subs = s.substitutions || {};
      (recette?.ingredients || []).forEach(ing => {
        if (!ing.item_cave_id || !ing.quantite || ing.optionnel) return;
        if (ing.unite !== 'cl' && ing.unite !== 'ml') return;
        if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) return;
        const qteCl = (ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite) * (s.portions || 1);
        const itemId = subs[ing.item_cave_id] || ing.item_cave_id;
        consoReelle[itemId] = (consoReelle[itemId] || 0) + qteCl;
      });
    }
  });

  // Construire les données barres tricolores
  const barres = Object.entries(consoPrevue).map(([itemId, c]) => {
    const item = estEnVoyage
      ? voyageBouteillesActives.find(b => b.item_cave_id === itemId)
      : cave?.categories?.flatMap(cat => cat.items).find(i => i.id === itemId);
    const clTotal = estEnVoyage
      ? parseFloat(item?.cl_restants_origine ?? item?.cl_restants_voyage ?? 0)
      : parseFloat(item?.cl_restants ?? 0) + (consoReelle[itemId] || 0);
    const clConsomme = consoReelle[itemId] || 0;
    const clPrevu = c.totalCl;
    const clRestant = clTotal - clConsomme;
    const clLibre = Math.max(0, clRestant - clPrevu);
    const depasse = clConsomme + clPrevu > clTotal;

    const pctConsomme = clTotal > 0 ? Math.min(100, (clConsomme / clTotal) * 100) : 0;
    const pctPrevu = clTotal > 0 ? Math.min(100 - pctConsomme, (clPrevu / clTotal) * 100) : 0;
    const pctLibre = Math.max(0, 100 - pctConsomme - pctPrevu);

    return { itemId, nom: item?.nom || c.nom, clTotal, clConsomme, clPrevu, clRestant, clLibre, depasse, pctConsomme, pctPrevu, pctLibre };
  });

  // Alternatives pour items dépassés
  const bouteillesDispos = estEnVoyage
    ? voyageBouteillesActives
    : cave?.categories?.flatMap(cat => cat.items).filter(i => i.detenu !== false) || [];

  const recettesDispo = recettes.filter(r => {
    if (r.type !== 'cocktail') return false;
    return !soireeMenuRecettesActives.some(mr => mr.recette_id === r.id);
  });

  const ingredientsNonLies = [];
  soireeMenuRecettesActives.forEach(mr => {
    const recette = recettes.find(r => r.id === mr.recette_id);
    (recette?.ingredients || []).forEach(ing => {
      if (!ing.item_cave_id && !ing.optionnel) ingredientsNonLies.push({ nom: ing.nom, recette: recette.nom });
    });
  });

  modal.innerHTML = `
    <div style="max-width:600px;margin:0 auto;background:var(--bg-card);border-radius:16px;padding:20px">

      <!-- EN-TÊTE -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <input type="text" value="${soireeMenuActive.nom}" style="font-size:1.1rem;font-weight:700;background:none;border:none;border-bottom:1px dashed var(--border);color:inherit;flex:1"
          onblur="renommerSoireeMenu(this.value)">
        <button onclick="document.getElementById('modal-tableau-bord-soiree').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1.3rem;cursor:pointer;margin-left:12px">✕</button>
      </div>

      ${ingredientsNonLies.length > 0 ? `
      <div style="background:var(--bg-danger);border-left:3px solid var(--border-danger);border-radius:0 8px 8px 0;padding:10px 12px;margin-bottom:14px;font-size:0.82rem;color:var(--text-danger)">
        🔗 ${ingredientsNonLies.length} ingrédient(s) non lié(s) — ${ingredientsNonLies.map(i => i.nom).join(', ')}
      </div>` : ''}

      <!-- COCKTAILS DU MENU -->
      <div style="margin-bottom:16px">
        <div style="font-size:0.85rem;font-weight:600;margin-bottom:8px">🍸 Cocktails du menu</div>
        ${soireeMenuRecettesActives.length === 0 ? `<div style="font-size:0.8rem;color:var(--text-muted)">Aucun cocktail ajouté.</div>` : ''}
        ${soireeMenuRecettesActives.map(mr => {
          const recette = recettes.find(r => r.id === mr.recette_id);
          const vp = estEnVoyage ? calculerVerresPossiblesVoyage(recette) : calculerVerresPossibles(recette);
          const nbServis = (services || []).filter(s => s.recette_id === mr.recette_id).reduce((acc, s) => acc + (s.portions || 1), 0);
return `
  <div style="padding:8px 0;border-bottom:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <span style="font-size:0.9rem;font-weight:600;cursor:pointer" onclick="ouvrirFicheRecette && ouvrirFicheRecette('${recette?.id}')">${recette?.nom || '—'}</span>
        <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.85rem;padding:0 4px" onclick="ouvrirFicheRecette && ouvrirFicheRecette('${recette?.id}')">ℹ️</button>
        ${vp ? `<span style="font-size:0.72rem;color:${vp.max <= 2 ? 'var(--text-warning)' : 'var(--text-success)'};margin-left:6px">${estEnVoyage ? '🧳' : '🍸'} ${vp.max}v</span>` : ''}
        ${nbServis > 0 ? `<span style="font-size:0.72rem;color:var(--text-danger);margin-left:6px">✓ ${nbServis} servi${nbServis > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:6px">
<button class="btn-outline" style="padding:2px 8px" onclick="ajusterPortionsMenu('${mr.id}', -1); renderTableauBordSoiree()">−</button>
        <span style="min-width:20px;text-align:center;font-size:0.9rem">${mr.portions_prevues}</span>
        <button class="btn-outline" style="padding:2px 8px" onclick="ajusterPortionsMenu('${mr.id}', 1); renderTableauBordSoiree()">+</button>
        <button class="btn-icon" style="color:var(--text-danger)" onclick="retirerRecetteMenu('${mr.id}')">🗑</button>
      </div>
    </div>
  </div>`;
        }).join('')}
        <select id="select-ajout-recette" style="width:100%;margin-top:10px;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary)">
          <option value="">+ Ajouter un cocktail au menu…</option>
          ${recettesDispo.map(r => `<option value="${r.id}">${r.nom}</option>`).join('')}
        </select>
      </div>

      <!-- BARRES TRICOLORES -->
      ${barres.length > 0 ? `
      <div style="margin-bottom:16px">
        <div style="font-size:0.85rem;font-weight:600;margin-bottom:10px">📊 Ingrédients</div>
        ${barres.map(b => `
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px">
              <span style="font-weight:600;color:${b.depasse ? 'var(--text-danger)' : 'var(--text-primary)'}">${b.nom}</span>
              <span style="color:var(--text-muted)">${Math.round(b.clRestant*10)/10}cl restants · ${Math.round(b.clPrevu*10)/10}cl prévus</span>
            </div>
            <div style="height:8px;background:var(--bg);border-radius:4px;overflow:hidden;display:flex">
              <div style="height:100%;width:${b.pctConsomme}%;background:#e53e3e;flex-shrink:0"></div>
              <div style="height:100%;width:${b.pctPrevu}%;background:${b.depasse ? '#e53e3e' : '#ed8936'};flex-shrink:0"></div>
              <div style="height:100%;width:${b.pctLibre}%;background:#38a169;flex-shrink:0"></div>
            </div>
            ${b.depasse ? `
            <div style="font-size:0.72rem;color:var(--text-danger);margin-top:3px">
              ⚠️ Dépassement de ${Math.round((b.clConsomme + b.clPrevu - b.clTotal)*10)/10}cl
              ${(() => {
                const catId = categorieDeItemGlobal(b.itemId);
                const alt = bouteillesDispos.find(bt => {
                  const btId = estEnVoyage ? bt.item_cave_id : bt.id;
                  if (btId === b.itemId) return false;
                  const btCat = categorieDeItemGlobal(btId);
                  return btCat === catId;
                });
                return alt ? ` → Alternative : <strong>${alt.nom}</strong>` : '';
              })()}
            </div>` : ''}
          </div>
        `).join('')}
      </div>` : ''}

      <!-- SERVICE — INVITÉS -->
      <div style="margin-bottom:16px">
        <div style="font-size:0.85rem;font-weight:600;margin-bottom:8px">👥 Service (${(invites||[]).length} invité${(invites||[]).length > 1 ? 's' : ''})</div>
        ${(invites||[]).length === 0 ? '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Aucun invité.</div>' : ''}
${(invites||[]).map(inv => {
  const lienQR = `${window.location.origin}/guest.html?invite=${inv.token}`;
  const cocktailsInvite = servicesParInvite[inv.id] || [];
  return `
<div style="padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:0.88rem;font-weight:600">👤 ${inv.nom_invite || 'Invité'}</div>
        <div style="display:flex;gap:6px">
          <button class="btn-outline" style="padding:4px 8px;font-size:0.75rem" title="QR défi gustatif" onclick="afficherQRInvite('${lienQR}', '${inv.nom_invite}')">📱</button>
          <button class="btn-outline" style="padding:4px 8px;font-size:0.75rem;color:var(--text-danger)" onclick="supprimerInviteService('${inv.id}')">🗑</button>
        </div>
      </div>
      ${inv.note ? `<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:3px;font-style:italic">📝 ${inv.note}</div>` : ''}
      ${cocktailsInvite.length === 0 ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Aucun cocktail assigné</div>` : ''}
${cocktailsInvite.map(s => {
  const r = recettes.find(rec => rec.id === s.recette_id);
  const couleur = s.statut === 'servi' ? 'var(--text-success)' : 'var(--text-warning)';
  const icone = s.statut === 'servi' ? '✅' : '🟡';
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
      <span style="font-size:0.78rem;color:${couleur}">${icone} ${r?.nom || s.recette_id}</span>
${s.statut === 'assigne' ? `
        <button style="background:none;border:1px solid var(--text-success);border-radius:6px;padding:2px 8px;font-size:0.75rem;color:var(--text-success);cursor:pointer"
          onclick="marquerServi(this.dataset.sid, this.dataset.rid, parseInt(this.dataset.portions))"
          data-sid="${s.id}" data-rid="${s.recette_id}" data-portions="${s.portions || 1}">✅ Servi</button>
      ` : ''}
    </div>
  `;
}).join('')}
    </div>
  `;
}).join('')}
<div style="display:flex;gap:8px;margin-top:8px">
  <button class="btn-outline" style="flex:1;font-size:0.82rem" onclick="ajouterInviteService('liste')">👤 + Invité</button>
  <button class="btn-outline" style="flex:1;font-size:0.82rem" onclick="ouvrirAssignationInvite()">🍸 Assigner</button>
  <button class="btn-outline" style="flex:1;font-size:0.82rem" onclick="afficherQRChoixMenu()">📱 QR Choix</button>
</div>
      </div>

     <!-- SERVICES EFFECTUÉS -->
      ${(services||[]).length > 0 ? `
      <div style="margin-bottom:16px">
        <div style="font-size:0.85rem;font-weight:600;margin-bottom:8px">✅ Services effectués</div>
        ${(services||[]).map(s => {
          const r = recettes.find(rec => rec.id === s.recette_id);
          const nom = r?.nom || s.recette_id;
          const heure = new Date(s.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;padding:6px 0;border-bottom:1px solid var(--border)">
              <div>
                <span style="font-weight:600">${nom}</span>
                <span style="color:var(--text-muted);margin-left:6px">${s.portions} verre${s.portions > 1 ? 's' : ''} · ${heure}</span>
              </div>
              <button style="background:none;border:none;color:var(--text-danger);cursor:pointer;font-size:0.9rem" onclick="annulerService('${s.id}', '${s.recette_id}', ${s.portions})">🗑</button>
            </div>
          `;
        }).join('')}
      </div>` : ''}
      <button class="btn-outline" style="width:100%;margin-top:8px;border-color:var(--text-danger);color:var(--text-danger)" onclick="terminerSoireeService()">
        🏁 Terminer la soirée
      </button>
    </div>
`;
  document.getElementById('select-ajout-recette').onchange = async (e) => {
    if (!e.target.value) return;
    await ajouterRecetteMenu(e.target.value);
  };
}
async function ajouterInviteService(modeChoix) {
  const modal = document.createElement('div');
  modal.id = 'modal-ajout-invite';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  
  modal.innerHTML = `
    <div style="max-width:400px;width:100%;background:var(--bg-card);border-radius:16px;padding:20px">
      <div style="font-size:1rem;font-weight:700;margin-bottom:16px">👤 Nouvel invité</div>
      
      <input type="text" id="invite-prenom" placeholder="Prénom *" 
        style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.9rem;box-sizing:border-box;margin-bottom:8px">
      
      <textarea id="invite-note" placeholder="Note (optionnel) — goûts, allergies, préférences..."
        style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;height:70px;resize:none;margin-bottom:12px"></textarea>

      ${modeChoix === 'assigne' ? `
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px">Cocktail assigné :</div>
      <select id="invite-cocktail" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.85rem;margin-bottom:12px">
        <option value="">— Choisir un cocktail —</option>
        ${soireeMenuRecettesActives.map(mr => {
          const r = recettes.find(rec => rec.id === mr.recette_id);
          return `<option value="${mr.recette_id}">${r?.nom || mr.recette_id}</option>`;
        }).join('')}
      </select>` : `
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px">L'invité choisira via QR code.</div>`}

      <div style="display:flex;gap:8px">
        <button class="btn-outline" style="flex:1" onclick="document.getElementById('modal-ajout-invite').remove()">Annuler</button>
        <button class="btn-primary" style="flex:1" onclick="confirmerAjoutInvite('${modeChoix}')">✅ Ajouter</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('invite-prenom')?.focus(), 100);
}

async function confirmerAjoutInvite(modeChoix) {
  const nom = document.getElementById('invite-prenom')?.value.trim();
  if (!nom) { alert('Prénom obligatoire.'); return; }
  const note = document.getElementById('invite-note')?.value.trim() || null;
  
  let recetteId = null;
  let modeChoixBDD = 'manuel';
  let statut = 'en_attente';

  if (modeChoix === 'assigne') {
    recetteId = document.getElementById('invite-cocktail')?.value || null;
    modeChoixBDD = 'manuel';
    statut = recetteId ? 'recette_choisie' : 'en_attente';
  } else if (modeChoix === 'libre') {
    modeChoixBDD = 'libre';
    statut = 'en_attente';
  } else {
    // 'liste' — juste prénom, pas de cocktail, pas de QR
    modeChoixBDD = 'manuel';
    statut = 'en_attente';
  }

  const token = Math.random().toString(36).substring(2, 10);
const { error } = await db.from('sessions_invites').insert({
    user_id: currentUser.id,
    token,
    nom_invite: nom,
    note,
    nom_session: soireeMenuActive.nom,
    soiree_menu_id: soireeMenuActive.id,
    is_master: false,
    mode_choix: modeChoixBDD,
    recette_id: recetteId,
    statut,
    recettes_disponibles: soireeMenuRecettesActives.map(mr => mr.recette_id),
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
  });
  if (error) { alert('Erreur : ' + error.message); return; }
  document.getElementById('modal-ajout-invite')?.remove();
  await renderTableauBordSoiree();
}
async function ouvrirAssignationInvite() {
  const { data: invites } = await db.from('sessions_invites')
    .select('*')
    .eq('soiree_menu_id', soireeMenuActive.id)
    .eq('is_master', false)
    .order('created_at');

  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;
  const bouteilles = estEnVoyage
    ? voyageBouteillesActives
    : cave?.categories?.flatMap(c => c.items).filter(i => i.detenu !== false) || [];

  const modal = document.createElement('div');
  modal.id = 'modal-assignation';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="max-width:440px;width:100%;background:var(--bg-card);border-radius:16px;padding:20px;max-height:90vh;overflow-y:auto">
      <div style="font-size:1rem;font-weight:700;margin-bottom:16px">🍸 Assigner un cocktail</div>
      ${(invites||[]).length === 0 ? '<div style="font-size:0.85rem;color:var(--text-muted)">Aucun invité dans la soirée.</div>' : `
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px">Invité :</div>
      <select id="assign-invite" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.85rem;margin-bottom:12px">
        <option value="">— Choisir un invité —</option>
        ${(invites||[]).map(i => {
          const r = recettes.find(rec => rec.id === i.recette_id);
          return `<option value="${i.id}">${i.nom_invite}${r ? ' (' + r.nom + ')' : ''}</option>`;
        }).join('')}
      </select>
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px">Cocktail :</div>
      <select id="assign-cocktail" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.85rem;margin-bottom:12px"
        onchange="renderIngredientsAssignation(this.value)">
        <option value="">— Choisir un cocktail —</option>
        ${soireeMenuRecettesActives.map(mr => {
          const r = recettes.find(rec => rec.id === mr.recette_id);
          return `<option value="${mr.recette_id}">${r?.nom || mr.recette_id}</option>`;
        }).join('')}
      </select>
      <div id="assign-ingredients" style="margin-bottom:12px"></div>
      `}
      <div style="display:flex;gap:8px">
        <button class="btn-outline" style="flex:1" onclick="document.getElementById('modal-assignation').remove()">Annuler</button>
        ${(invites||[]).length > 0 ? `<button class="btn-primary" style="flex:1" onclick="confirmerAssignation()">✅ Assigner</button>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Stocker les bouteilles dans window pour y accéder depuis renderIngredientsAssignation
  window._assignBouteilles = bouteilles;
  window._assignSubs = {};
}

function renderIngredientsAssignation(recetteId) {
  const container = document.getElementById('assign-ingredients');
  if (!container) return;
  if (!recetteId) { container.innerHTML = ''; return; }

  const recette = recettes.find(r => r.id === recetteId);
  const bouteilles = window._assignBouteilles || [];
  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;

  const ingsTrackables = (recette?.ingredients || []).filter(ing =>
    ing.item_cave_id && ing.quantite &&
    (ing.unite === 'cl' || ing.unite === 'ml') &&
    !ing.optionnel &&
    !CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))
  );

  if (ingsTrackables.length === 0) { container.innerHTML = ''; return; }

  window._assignSubs = {};
  ingsTrackables.forEach(ing => { window._assignSubs[ing.item_cave_id] = ing.item_cave_id; });

  container.innerHTML = `
    <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px">Bouteilles à utiliser :</div>
    ${ingsTrackables.map(ing => {
      const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <select style="flex:1;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.78rem;margin-right:8px"
            onchange="window._assignSubs['${ing.item_cave_id}']=this.value">
            ${bouteilles.map(b => {
              const bId = estEnVoyage ? b.item_cave_id : b.id;
              return `<option value="${bId}" ${bId === ing.item_cave_id ? 'selected' : ''}>${b.nom}</option>`;
            }).join('')}
          </select>
          <span style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${qteCl}cl</span>
        </div>
      `;
    }).join('')}
  `;
}

async function confirmerAssignation() {
  const inviteId = document.getElementById('assign-invite')?.value;
  const recetteId = document.getElementById('assign-cocktail')?.value;
  if (!inviteId || !recetteId) { alert('Sélectionne un invité et un cocktail.'); return; }

  const subs = window._assignSubs || {};

  await db.from('soiree_services').insert({
    id: 'srv-assign-' + Date.now(),
    user_id: currentUser.id,
    soiree_menu_id: soireeMenuActive.id,
    recette_id: recetteId,
    portions: 1,
    item_cave_id: recetteId,
    cl_servi: 0,
    statut: 'assigne',
    invite_id: inviteId,
    substitutions: Object.keys(subs).length > 0 ? subs : null
  });

  document.getElementById('modal-assignation')?.remove();
  await renderTableauBordSoiree();
}
async function marquerServi(serviceId, recetteId, portions) {
  const recette = recettes.find(r => r.id === recetteId);
  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;

  // Charger les substitutions déjà définies à l'assignation
  const { data: serviceData } = await db.from('soiree_services')
    .select('substitutions').eq('id', serviceId).single();
  const subsPredef = serviceData?.substitutions || {};
  
  const bouteilles = estEnVoyage
    ? voyageBouteillesActives
    : cave?.categories?.flatMap(c => c.items).filter(i => i.detenu !== false) || [];

  const ingsTrackables = (recette?.ingredients || []).filter(ing =>
    ing.item_cave_id && ing.quantite &&
    (ing.unite === 'cl' || ing.unite === 'ml') &&
    !ing.optionnel &&
    !CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))
  );

  if (ingsTrackables.length === 0) {
    // Pas d'ingrédients trackables — confirmer directement
    if (!confirm('Servir ce cocktail ?')) return;
    await db.from('soiree_services').update({ statut: 'servi' }).eq('id', serviceId);
    await renderTableauBordSoiree();
    return;
  }

  // Afficher modal substitution
  const subs = {};
  ingsTrackables.forEach(ing => { 
    subs[ing.item_cave_id] = subsPredef[ing.item_cave_id] || ing.item_cave_id; 
  });
  window._marquerServiSubs = { ...subs };
  window._marquerServiId = serviceId;
  window._marquerServiRecetteId = recetteId;
  window._marquerServiPortions = portions;

  const modal = document.createElement('div');
  modal.id = 'modal-marquer-servi';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="max-width:400px;width:100%;background:var(--bg-card);border-radius:16px;padding:20px">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px">🍸 ${recette?.nom || recetteId}</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:14px">${portions} portion${portions > 1 ? 's' : ''} — vérifie les bouteilles</div>
      ${ingsTrackables.map(ing => {
        const qteCl = (ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite) * portions;
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
            <select style="flex:1;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.78rem;margin-right:8px"
              onchange="window._marquerServiSubs['${ing.item_cave_id}']=this.value">
              ${bouteilles.map(b => {
                const bId = estEnVoyage ? b.item_cave_id : b.id;
                const defaultId = subsPredef[ing.item_cave_id] || ing.item_cave_id;
                return `<option value="${bId}" ${bId === defaultId ? 'selected' : ''}>${b.nom}</option>`;
              }).join('')}
            </select>
            <span style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${Math.round(qteCl*10)/10}cl</span>
          </div>
        `;
      }).join('')}
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn-outline" style="flex:1" onclick="document.getElementById('modal-marquer-servi').remove()">Annuler</button>
        <button class="btn-primary" style="flex:1" id="btn-confirmer-marquer">✅ Servir</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btn-confirmer-marquer').addEventListener('click', async () => {
    const subs = window._marquerServiSubs;
    const serviceId = window._marquerServiId;
    const recetteId = window._marquerServiRecetteId;
    const portions = window._marquerServiPortions;
    const recette = recettes.find(r => r.id === recetteId);
    const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;
    await db.from('soiree_services').update({ statut: 'servi', substitutions: subs }).eq('id', serviceId);
    for (const ing of (recette?.ingredients || [])) {
      if (!ing.item_cave_id || !ing.quantite || ing.optionnel) continue;
      if (ing.unite !== 'cl' && ing.unite !== 'ml') continue;
      if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) continue;
      const qteCl = (ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite) * portions;
      const itemId = subs[ing.item_cave_id] || ing.item_cave_id;
      if (estEnVoyage) {
        const b = voyageBouteillesActives.find(b => b.item_cave_id === itemId);
        if (!b) continue;
        const nouveau = Math.max(0, parseFloat(b.cl_restants_voyage ?? 0) - qteCl);
        await db.from('mode_voyage_bouteilles').update({ cl_restants_voyage: nouveau })
          .eq('item_cave_id', itemId).eq('mode_voyage_id', voyageActif.id);
        b.cl_restants_voyage = nouveau;
      } else {
        const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === itemId);
        if (!item) continue;
        const nouveau = Math.max(0, (item.cl_restants ?? 0) - qteCl);
        await db.from('items').update({ cl_restants: nouveau }).eq('id', itemId).eq('user_id', currentUser.id);
        item.cl_restants = nouveau;
      }
    }
    document.getElementById('modal-marquer-servi')?.remove();
    await renderTableauBordSoiree();
  }, { once: true });
}
function afficherQRInvite(lien, nomInvite) {
  const modal = document.createElement('div');
  modal.id = 'modal-qr-invite';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:24px;text-align:center;max-width:300px;width:100%">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px">📱 ${nomInvite}</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:16px">Scanne pour le défi gustatif</div>
      <div id="qr-invite-canvas" style="display:flex;justify-content:center;margin-bottom:16px"></div>
      <div style="font-size:0.72rem;color:var(--text-muted);word-break:break-all;margin:8px 0;padding:8px;background:var(--bg);border-radius:6px;text-align:left">${lien}</div>
      <button class="btn-outline" style="width:100%;margin-bottom:8px;font-size:0.8rem" onclick="navigator.clipboard.writeText('${lien}').then(()=>alert('Lien copié !'))">📋 Copier le lien</button>
      <button class="btn-outline" style="width:100%" onclick="document.getElementById('modal-qr-invite').remove()">Fermer</button>
    </div>
  `;
  document.body.appendChild(modal);
  new QRCode(document.getElementById('qr-invite-canvas'), {
    text: lien,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff'
  });
}

function afficherQRChoixMenu() {
  const lien = `${window.location.origin}/guest.html?session=${soireeMenuActive.id}`;
  const modal = document.createElement('div');
  modal.id = 'modal-qr-choix';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:24px;text-align:center;max-width:300px;width:100%">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px">📱 Choisir un cocktail</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:16px">L'invité scanne et choisit parmi le menu</div>
      <div id="qr-choix-canvas" style="display:flex;justify-content:center;margin-bottom:16px"></div>
      <div style="font-size:0.72rem;color:var(--text-muted);word-break:break-all;margin:8px 0;padding:8px;background:var(--bg);border-radius:6px;text-align:left">${lien}</div>
      <button class="btn-outline" style="width:100%;margin-bottom:8px;font-size:0.8rem" onclick="navigator.clipboard.writeText('${lien}').then(()=>alert('Lien copié !'))">📋 Copier le lien</button>
      <button class="btn-outline" style="width:100%" onclick="document.getElementById('modal-qr-choix').remove()">Fermer</button>
    </div>
  `;
  document.body.appendChild(modal);
  new QRCode(document.getElementById('qr-choix-canvas'), {
    text: lien,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff'
  });
}
async function servirCocktail(menuRecetteId, recetteId, recetteNom, portions) {
  portions = portions || 1;
  const recette = recettes.find(r => r.id === recetteId);
  if (!recette) return;

  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;
  const bouteilles = estEnVoyage
    ? voyageBouteillesActives
    : cave?.categories?.flatMap(c => c.items).filter(i => i.detenu !== false) || [];

  // Charger invités pour ce cocktail
const { data: tousInvites } = await db.from('sessions_invites')
    .select('*')
    .eq('soiree_menu_id', soireeMenuActive.id)
    .eq('is_master', false)
    .order('created_at');

  // Chercher les invités qui ont ce cocktail assigné dans soiree_services
  const { data: servicesAssignes } = await db.from('soiree_services')
    .select('invite_id')
    .eq('soiree_menu_id', soireeMenuActive.id)
    .eq('recette_id', recetteId)
    .eq('statut', 'assigne');

  const inviteIdsAssignes = (servicesAssignes || []).map(s => s.invite_id?.toString());
  const invitesAvecCecocktail = (tousInvites || []).filter(i =>
    inviteIdsAssignes.includes(i.id?.toString())
  );
  const invitesSansCommande = (tousInvites || []).filter(i =>
    !i.recette_id && i.statut !== 'termine'
  );

  const ingsTrackables = (recette.ingredients || []).filter(ing =>
    ing.item_cave_id && ing.quantite &&
    (ing.unite === 'cl' || ing.unite === 'ml') &&
    !ing.optionnel &&
    !CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))
  );

const subs = {};
ingsTrackables.forEach(ing => { subs[ing.item_cave_id] = ing.item_cave_id; });
window._servir_subs = { ...subs };
window._servirInviteIds = [];

  const modal = document.createElement('div');
  modal.id = 'modal-servir-cocktail';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';

  modal.innerHTML = `
    <div style="max-width:440px;width:100%;background:var(--bg-card);border-radius:16px;padding:20px">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px">🍸 Servir ${recetteNom}</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:14px">${portions} portion${portions > 1 ? 's' : ''}</div>

      <!-- ASSOCIATION INVITÉ -->
      <div style="margin-bottom:14px">
        ${invitesAvecCecocktail.length > 0 ? `
          <div style="font-size:0.82rem;color:var(--text-success);font-weight:600;margin-bottom:6px">
            ✅ ${invitesAvecCecocktail.length} invité${invitesAvecCecocktail.length > 1 ? 's' : ''} ont commandé ce cocktail :
          </div>
          ${invitesAvecCecocktail.map(i => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border:1px solid var(--border-success);border-radius:6px;margin-bottom:4px;background:var(--bg-success)">
              <span style="font-size:0.85rem;font-weight:600">${i.nom_invite}</span>
              <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;cursor:pointer">
                <input type="checkbox" id="serv-inv-${i.id}" checked> Servir
              </label>
            </div>
          `).join('')}
        ` : ''}
        
        <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px;margin-top:${invitesAvecCecocktail.length > 0 ? '10px' : '0'}">
          Autres invités :
        </div>
        <select id="serv-autre-invite" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.85rem">
          <option value="">— Aucun autre invité —</option>
          ${[...invitesSansCommande, ...(tousInvites||[]).filter(i => i.recette_id && i.recette_id !== recetteId && i.statut !== 'termine')].map(i =>
            `<option value="${i.id}">${i.nom_invite}${i.recette_id ? ' (a commandé autre chose)' : ''}</option>`
          ).join('')}
        </select>
      </div>

      <!-- SUBSTITUTIONS BOUTEILLES -->
      ${ingsTrackables.length > 0 ? `
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px">Bouteilles utilisées :</div>
      ${ingsTrackables.map(ing => {
        const qteCl = (ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite) * portions;
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
            <select style="flex:1;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.78rem;margin-right:8px"
              onchange="window._servir_subs['${ing.item_cave_id}']=this.value">
              ${bouteilles.map(b => {
                const bId = estEnVoyage ? b.item_cave_id : b.id;
                return `<option value="${bId}" ${bId === ing.item_cave_id ? 'selected' : ''}>${b.nom}</option>`;
              }).join('')}
            </select>
            <span style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${Math.round(qteCl*10)/10}cl</span>
          </div>
        `;
      }).join('')}` : ''}

      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn-outline" style="flex:1" onclick="document.getElementById('modal-servir-cocktail').remove()">Annuler</button>
        <button class="btn-primary" style="flex:1" id="btn-confirmer-servir">✅ Confirmer</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
 document.getElementById('btn-confirmer-servir').addEventListener('click', () => {
  confirmerServir(recetteId, portions, invitesAvecCecocktail.map(i => i.id));
});
}

async function confirmerServir(recetteId, portions, inviteIds) {
  const recette = recettes.find(r => r.id === recetteId);
  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;
  const subs = window._servir_subs || {};

  // Marquer les invités cochés comme servis
  const invitesCochés = (inviteIds || []).filter(id => {
    const checkbox = document.getElementById('serv-inv-' + id);
    return checkbox ? checkbox.checked : true;
  });
  for (const invId of invitesCochés) {
    await db.from('sessions_invites').update({ statut: 'termine' }).eq('id', invId);
  }
  const autreInviteId = document.getElementById('serv-autre-invite')?.value;
  if (autreInviteId) {
    await db.from('sessions_invites').update({
      statut: 'degustation',
      recette_id: recetteId
    }).eq('id', autreInviteId);
  }

  // Logger UNE SEULE fois le service (pas par ingrédient)
  await db.from('soiree_services').insert({
    id: 'srv-' + Date.now(),
    user_id: currentUser.id,
    soiree_menu_id: soireeMenuActive.id,
    recette_id: recetteId,
    portions,
    item_cave_id: recetteId, // référence recette, pas ingrédient
    cl_servi: 0 // pas utilisé pour le comptage
  });

  // Décrémenter cave par ingrédient
  for (const ing of (recette?.ingredients || [])) {
    if (!ing.item_cave_id || !ing.quantite || ing.optionnel) continue;
    if (ing.unite !== 'cl' && ing.unite !== 'ml') continue;
    if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) continue;
    const qteCl = (ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite) * portions;
    const itemId = subs[ing.item_cave_id] || ing.item_cave_id;

    if (estEnVoyage) {
      const b = voyageBouteillesActives.find(b => b.item_cave_id === itemId);
      if (!b) continue;
      const nouveau = Math.max(0, parseFloat(b.cl_restants_voyage ?? 0) - qteCl);
      await db.from('mode_voyage_bouteilles').update({ cl_restants_voyage: nouveau })
        .eq('item_cave_id', itemId).eq('mode_voyage_id', voyageActif.id);
      b.cl_restants_voyage = nouveau;
    } else {
      const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === itemId);
      if (!item) continue;
      const nouveau = Math.max(0, (item.cl_restants ?? 0) - qteCl);
      await db.from('items').update({ cl_restants: nouveau }).eq('id', itemId).eq('user_id', currentUser.id);
      item.cl_restants = nouveau;
    }
  }

  document.getElementById('modal-servir-cocktail')?.remove();
  await renderTableauBordSoiree();
}

async function terminerSoireeService() {
  if (!confirm('Terminer la soirée ?')) return;
  await db.from('soiree_menu').update({ statut: 'termine' }).eq('id', soireeMenuActive.id);
  soireeMenuActive.statut = 'termine';
  document.getElementById('modal-tableau-bord-soiree')?.remove();
  if (voyageActif) ouvrirTableauBordVoyage();
}
async function ajouterRecetteMenu(recetteId) {
  const { data } = await db.from('soiree_menu_recettes').insert({
    id: 'smr-' + Date.now(),
    soiree_menu_id: soireeMenuActive.id,
    recette_id: recetteId,
    portions_prevues: 6,
    ordre: soireeMenuRecettesActives.length
  }).select().single();
  if (data) soireeMenuRecettesActives.push(data);
  renderTableauBordSoiree();
}
 async function annulerService(serviceId, recetteId, portions) {
  if (!confirm('Annuler ce service et remettre les cl en cave ?')) return;

  const recette = recettes.find(r => r.id === recetteId);
  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;

  // Remettre les cl en cave
  for (const ing of (recette?.ingredients || [])) {
    if (!ing.item_cave_id || !ing.quantite || ing.optionnel) continue;
    if (ing.unite !== 'cl' && ing.unite !== 'ml') continue;
    if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) continue;
    const qteCl = (ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite) * portions;
    const itemId = ing.item_cave_id;

    if (estEnVoyage) {
      const b = voyageBouteillesActives.find(b => b.item_cave_id === itemId);
      if (!b) continue;
      const nouveau = parseFloat(b.cl_restants_voyage ?? 0) + qteCl;
      await db.from('mode_voyage_bouteilles').update({ cl_restants_voyage: nouveau })
        .eq('item_cave_id', itemId).eq('mode_voyage_id', voyageActif.id);
      b.cl_restants_voyage = nouveau;
    } else {
      const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === itemId);
      if (!item) continue;
      const nouveau = (item.cl_restants ?? 0) + qteCl;
      await db.from('items').update({ cl_restants: nouveau }).eq('id', itemId).eq('user_id', currentUser.id);
      item.cl_restants = nouveau;
    }
  }

  // Supprimer le service
  await db.from('soiree_services').delete().eq('id', serviceId);
  await renderTableauBordSoiree();
}
async function ouvrirGenerateurRecettes() {
  if (!voyageActif || voyageBouteillesActives.length === 0) {
    alert('Active le mode voyage avec des bouteilles pour générer des recettes.');
    return;
  }
  const modal = document.createElement('div');
  modal.id = 'modal-generateur';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9800;overflow-y:auto;padding:20px';
  modal.innerHTML = `
    <div style="max-width:560px;margin:0 auto;background:var(--bg-card);border-radius:16px;padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:1rem;font-weight:700">✨ Générer des recettes voyage</div>
        <button onclick="document.getElementById('modal-generateur').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1.3rem;cursor:pointer">✕</button>
      </div>
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px">
        🧳 ${voyageBouteillesActives.length} bouteilles — ${voyageBouteillesActives.map(b => b.nom).join(', ')}
      </div>
      <input type="text" id="gen-style" placeholder="Style souhaité (optionnel) — ex: fruité, sec, apéritif..."
        style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;margin-bottom:12px">
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn-outline active" id="gen-nb-2" style="flex:1" onclick="window._genNb=2;['2','3','5'].forEach(n=>document.getElementById('gen-nb-'+n)?.classList.remove('active'));this.classList.add('active')">2 recettes</button>
        <button class="btn-outline" id="gen-nb-3" style="flex:1" onclick="window._genNb=3;['2','3','5'].forEach(n=>document.getElementById('gen-nb-'+n)?.classList.remove('active'));this.classList.add('active')">3 recettes</button>
        <button class="btn-outline" id="gen-nb-5" style="flex:1" onclick="window._genNb=5;['2','3','5'].forEach(n=>document.getElementById('gen-nb-'+n)?.classList.remove('active'));this.classList.add('active')">5 recettes</button>
      </div>
      <button class="btn-primary" style="width:100%;padding:12px" onclick="lancerGenerateur()">✨ Générer</button>
      <div id="gen-resultats" style="margin-top:16px"></div>
    </div>
  `;
  window._genNb = 2;
  document.body.appendChild(modal);
}

async function lancerGenerateur() {
  const style = document.getElementById('gen-style')?.value.trim() || '';
  const nb = window._genNb || 2;
  const resultats = document.getElementById('gen-resultats');
  if (!resultats) return;
  resultats.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">⏳ Génération en cours...</div>';
  const ingredients = voyageBouteillesActives
    .filter(b => parseFloat(b.cl_restants_voyage) > 0)
    .map(b => ({ nom: b.nom, cl_restants: b.cl_restants_voyage }));
  const response = await fetch('/api/generer-recette', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredients, style, nb_propositions: nb })
  });
  if (!response.ok) {
    resultats.innerHTML = '<div style="color:var(--text-danger)">Erreur lors de la génération.</div>';
    return;
  }
  const data = await response.json();
  const propositions = data.propositions || [];
  if (propositions.length === 0) {
    resultats.innerHTML = '<div style="color:var(--text-muted)">Aucune proposition générée.</div>';
    return;
  }
  resultats.innerHTML = propositions.map((p, idx) => `
    <div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div>
          <span style="font-size:0.95rem;font-weight:700">${p.nom}</span>
          <span style="font-size:0.72rem;padding:2px 8px;border-radius:20px;margin-left:8px;${p.badge === 'classique' ? 'background:var(--bg-success);color:var(--text-success)' : 'background:var(--bg-accent);color:var(--text-accent)'}">${p.badge}</span>
        </div>
        <span style="font-size:0.75rem;color:var(--text-muted)">${p.confiance}% confiance</span>
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">${p.famille} · ${p.technique} · ${p.verre}</div>
      <div style="margin-bottom:8px">
        ${(p.dosages || []).map(d => `
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;padding:3px 0;border-bottom:1px solid var(--border)">
            <span>${d.nom}</span>
            <span style="color:var(--text-muted)">${d.quantite} ${d.unite}</span>
          </div>
        `).join('')}
      </div>
      ${p.note_bartender ? `<div style="font-size:0.78rem;color:var(--text-accent);margin-bottom:10px">💡 ${p.note_bartender}</div>` : ''}
      ${soireeMenuActive ? `
      <button class="btn-outline" style="width:100%;font-size:0.82rem" onclick="ajouterRecetteGenereeASoiree(${idx})">
        🎉 Ajouter à "${soireeMenuActive.nom}"
      </button>` : ''}
    </div>
  `).join('');
  window._genPropositions = propositions;
}

async function ajouterRecetteGenereeASoiree(idx) {
  const p = window._genPropositions?.[idx];
  if (!p || !soireeMenuActive) return;
  const recetteId = 'gen-' + Date.now();
 const { data, error } = await db.from('recettes').insert({
    id: recetteId,
    user_id: currentUser.id,
    nom: p.nom,
    type: 'cocktail',
    base_alcool: p.dosages?.[0]?.nom || '',
    difficulte: p.difficulte || 'facile',
    verre_type: p.verre || '',
    description_courte: p.note_bartender || '',
    gout_sucre: p.profil?.gout_sucre || 0,
    gout_amer: p.profil?.gout_amer || 0,
    gout_acide: p.profil?.gout_acide || 0,
    gout_fruite: p.profil?.gout_fruite || 0,
    gout_fume: p.profil?.gout_fume || 0,
    gout_floral: p.profil?.gout_floral || 0,
    gout_epice: p.profil?.gout_epice || 0,
    gout_cremeux: p.profil?.gout_cremeux || 0
  }).select().single();
  if (error) { alert('Erreur création recette : ' + error.message); return; }
  for (const d of (p.dosages || [])) {
    await db.from('recette_ingredients').insert({
      user_id: currentUser.id,
      recette_id: recetteId,
      nom: d.nom,
      quantite: d.unite === 'cl' ? d.quantite * 10 : d.quantite,
      unite: d.unite === 'cl' ? 'ml' : d.unite,
      optionnel: false
    });
  }
  const { data: mr } = await db.from('soiree_menu_recettes').insert({
    id: 'smr-' + Date.now(),
    soiree_menu_id: soireeMenuActive.id,
    recette_id: recetteId,
    portions_prevues: 1,
    ordre: soireeMenuRecettesActives.length
  }).select().single();
  if (mr) soireeMenuRecettesActives.push(mr);
  const { data: nouvelleRecette } = await db.from('recettes')
    .select('*, ingredients:recette_ingredients(*)')
    .eq('id', recetteId).single();
  if (nouvelleRecette) recettes.push(nouvelleRecette);
  document.getElementById('modal-generateur')?.remove();
  alert(`"${p.nom}" ajouté à la soirée !`);
  await renderTableauBordSoiree();
}
async function supprimerSoireeMenu(soireeId) {
  if (!confirm('Supprimer cette soirée ?')) return;
  await db.from('soiree_menu_recettes').delete().eq('soiree_menu_id', soireeId);
  await db.from('stock_reserve').delete().eq('soiree_menu_id', soireeId);
  await db.from('soiree_menu').delete().eq('id', soireeId);
  chargerSessions();
}
async function ajusterPortionsMenu(id, delta) {
  const mr = soireeMenuRecettesActives.find(m => m.id === id);
  if (!mr) return;
  mr.portions_prevues = Math.max(0, mr.portions_prevues + delta);
  await db.from('soiree_menu_recettes').update({ portions_prevues: mr.portions_prevues }).eq('id', id);
  renderTableauBordSoiree();
}

async function retirerRecetteMenu(id) {
  await db.from('soiree_menu_recettes').delete().eq('id', id);
  soireeMenuRecettesActives = soireeMenuRecettesActives.filter(m => m.id !== id);
  renderTableauBordSoiree();
}

async function renommerSoireeMenu(nom) {
  if (!nom.trim() || nom === soireeMenuActive.nom) return;
  soireeMenuActive.nom = nom.trim();
  await db.from('soiree_menu').update({ nom: nom.trim() }).eq('id', soireeMenuActive.id);
}

async function verrouillerSoireeMenu() {
  const estVoyageOuSolo = (voyageActif && soireeMenuActive?.voyage_id === voyageActif.id) || soireeMenuActive?.mode === 'solo';

  if (estVoyageOuSolo) {
    // Verrouillage immédiat sans réservation de stock
    await db.from('soiree_menu').update({ statut: 'verrouille' }).eq('id', soireeMenuActive.id);
    soireeMenuActive.statut = 'verrouille';
    renderTableauBordSoiree();
    return;
  }

  // Mode normal avec date et réservation stock
  if (!confirm('Verrouiller ce menu ? Le stock nécessaire sera réservé jusqu\'à la date de l\'événement.')) return;
  const dateEvenement = prompt('Date de la soirée (AAAA-MM-JJ) ?', new Date().toISOString().slice(0, 10));
  if (!dateEvenement) return;

  const consommation = calculerConsommationAgregee();
  for (const c of consommation) {
    if (c.inconnu) continue;
    await db.from('stock_reserve').insert({
      id: 'reserve-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      user_id: currentUser.id,
      item_id: c.itemId,
      soiree_menu_id: soireeMenuActive.id,
      cl_reserve: c.besoinCl,
      date_evenement: dateEvenement
    });
  }
  await db.from('soiree_menu').update({ statut: 'verrouille', date_evenement: dateEvenement }).eq('id', soireeMenuActive.id);
  await chargerStockReserve();
  soireeMenuActive.statut = 'verrouille';
  renderTableauBordSoiree();
}
async function chargerResumeDefiSolo() {
  const el = document.getElementById('resume-defi-solo');
  if (!el || !soireeMenuActive) return;
  const { data } = await db.from('sessions_invites').select('defi_reussi').eq('nom_session', soireeMenuActive.nom).eq('mode_choix', 'manuel');
  if (!data || data.length === 0) return;
  const nbRepondu = data.filter(i => i.defi_reussi !== null).length;
  const nbTrouve = data.filter(i => i.defi_reussi === true).length;
  el.innerHTML = `<div style="font-size:0.78rem;color:var(--text-accent);text-align:center">🎯 ${nbRepondu}/${data.length} ont relevé le défi — ${nbTrouve} ont trouvé</div>`;
}
function ouvrirAjoutInviteManuel() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:20px;max-width:380px;width:100%">
      <div style="font-size:1rem;font-weight:700;margin-bottom:12px">👤 Nouvel invité servi</div>
      <input type="text" id="invite-manuel-nom" placeholder="Prénom de l'invité" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);margin-bottom:10px">
      <select id="invite-manuel-recette" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);margin-bottom:16px">
        ${soireeMenuRecettesActives.map(mr => {
          const r = recettes.find(x => x.id === mr.recette_id);
          return `<option value="${mr.recette_id}">${r?.nom || '—'}</option>`;
        }).join('')}
      </select>
      <button class="btn-primary" style="width:100%" onclick="genererLienInviteManuel()">Générer le lien →</button>
      <div id="resultat-lien-invite" style="margin-top:12px"></div>
      <button class="btn-outline" style="width:100%;margin-top:8px" onclick="this.closest('div[style*=fixed]').remove()">Fermer</button>
    </div>
  `;
  document.body.appendChild(modal);
}

async function genererLienInviteManuel() {
  const nomInvite = document.getElementById('invite-manuel-nom').value.trim();
  const recetteId = document.getElementById('invite-manuel-recette').value;
  if (!nomInvite) { alert('Entre un prénom.'); return; }

  const { data, error } = await db.from('sessions_invites').insert({
    user_id: currentUser.id,
    nom_session: soireeMenuActive.nom,
    nom_invite: nomInvite,
    recette_id: recetteId,
    mode_choix: 'manuel',
    statut: 'recette_choisie',
    is_master: false,
    token: Math.random().toString(36).substring(2, 10),
    expires_at: new Date(Date.now() + 3 * 3600 * 1000).toISOString()
  }).select().single();

  if (error) { alert('Erreur : ' + error.message); return; }

  const lien = `https://bar-cocktail-smoky.vercel.app/guest.html?invite=${data.id}`;
  document.getElementById('resultat-lien-invite').innerHTML = `
    <div style="font-size:0.78rem;color:var(--text-muted);word-break:break-all;margin-bottom:8px">${lien}</div>
    <button class="btn-outline" style="width:100%" onclick="navigator.clipboard.writeText('${lien}');this.textContent='✅ Copié !'">📋 Copier ce lien</button>
  `;
}
async function creerSessionVoteRestreint(soireeMenuId) {
  const { data: menuRecettes } = await db.from('soiree_menu_recettes').select('*').eq('soiree_menu_id', soireeMenuId);
  const recetteIds = (menuRecettes || []).map(mr => mr.recette_id);

  const token = Math.random().toString(36).substring(2, 10);
  const expiresAt = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
  let nom = prompt('Nom de la soirée ?');
  if (!nom || !nom.trim()) { alert('Une soirée doit avoir un nom.'); return; }
  nom = nom.trim();

  await db.from('sessions_invites').insert({
    user_id: currentUser.id,
    token,
    nom_session: nom,
    mode_choix: 'restreint',
    recettes_disponibles: recetteIds,
    soiree_menu_id: soireeMenuId,
    expires_at: expiresAt,
    is_master: true
  });

  chargerSessions();
}
let voyageIdPourSession = null;

function ouvrirModalNouvelleSession(voyageId = null) {
  voyageIdPourSession = voyageId || null;
  document.getElementById('session-nom').value = '';

  // Si une sélection de recettes vient de "Recettes", basculer directement en mode verrouillé
  if (selectionPourSoireeEnAttente) {
    modeSessionActif = 'verrouille';
    document.getElementById('btn-mode-libre').classList.remove('active');
    document.getElementById('bloc-recettes-liste').style.display = '';
    document.getElementById('btn-mode-verrouille').classList.add('active');
  } else {
    modeSessionActif = 'libre';
    document.getElementById('btn-mode-libre').classList.add('active');
    document.getElementById('bloc-recettes-liste').style.display = 'none';
    document.getElementById('btn-mode-verrouille').classList.remove('active');
  }

  quizActif = true;
  document.getElementById('btn-quiz-oui').classList.add('active');
  document.getElementById('btn-quiz-non').classList.remove('active');

  // En mode voyage : filtrer sur cave voyage, sinon comportement normal
  const realisables = selectionPourSoireeEnAttente
    ? recettes.filter(r => selectionPourSoireeEnAttente.includes(r.id))
    : voyageId
      ? recettes.filter(r => r.type === 'cocktail' && calculerVerresPossiblesVoyage(r)?.max > 0)
      : recettes.filter(r => r.type === 'cocktail' && calculerDisponibilite(r) === 0);

  const liste = document.getElementById('session-recettes-liste');
  liste.innerHTML = realisables.map(r => `
    <div class="session-recette-item" onclick="this.querySelector('input').click()">
      <input type="checkbox" value="${r.id}" ${selectionPourSoireeEnAttente ? 'checked' : ''} />
      <div>
        <div class="session-recette-item-nom">${r.nom}</div>
        <div class="session-recette-item-meta">${r.base_alcool || ''} · ${(r.gouts || []).slice(0,2).join(' · ')}</div>
      </div>
    </div>
  `).join('');
  document.getElementById('modal-nouvelle-session').classList.add('visible');
}
async function creerSession() {
  const nom = document.getElementById('session-nom').value.trim();
  if (!nom) {
    alert('Donne un nom à ta soirée avant de lancer.');
    document.getElementById('session-nom').focus();
    return;
  }

  let recettesDisponibles;
  if (modeSessionActif === 'libre') {
    recettesDisponibles = voyageIdPourSession
      ? recettes.filter(r => r.type === 'cocktail' && calculerVerresPossiblesVoyage(r)?.max > 0).map(r => r.id)
      : recettes.filter(r => r.type === 'cocktail' && calculerDisponibilite(r) === 0).map(r => r.id);
  } else {
    const checks = document.querySelectorAll('#session-recettes-liste input[type=checkbox]:checked');
    recettesDisponibles = Array.from(checks).map(c => c.value);
  }

  const token = Math.random().toString(36).substring(2, 10);
  const expiresAt = new Date(Date.now() + 3 * 3600 * 1000).toISOString();

  const payload = {
    user_id: currentUser.id,
    token,
    nom_session: nom,
    mode_choix: modeSessionActif,
    quiz_actif: quizActif,
    recettes_disponibles: recettesDisponibles,
    expires_at: expiresAt,
    is_master: true
  };
  if (voyageIdPourSession) payload.voyage_id = voyageIdPourSession;

const { error } = await db.from('sessions_invites').insert(payload);
  if (error) { alert('Erreur création session : ' + error.message); return; }
  selectionPourSoireeEnAttente = null;

  voyageIdPourSession = null;
  document.getElementById('modal-nouvelle-session').classList.remove('visible');
  chargerSessions();
}

async function ouvrirSession(id) {
  const { data: session } = await db.from('sessions_invites')
    .select('*')
    .eq('id', id)
    .single();

  if (!session) { alert('Session introuvable'); return; }

  sessionActive = session;
 renderSessionActive(session);
abonnerRealtimeSession(session);
document.getElementById('modal-session-active').classList.add('visible');
}

function renderSessionActive(session) {
  const invites = session.invites || [];
  const recettesSession = recettes.filter(r => session.recettes_disponibles?.includes(r.id));
  const qrUrl = `https://bar-cocktail-smoky.vercel.app/guest.html?session=${session.token}`;

  document.getElementById('session-active-contenu').innerHTML = `
    <div style="margin-bottom:1.25rem">
      <div style="font-size:1.2rem;font-weight:600;margin-bottom:4px">${session.nom_session || 'Soirée sans nom'}</div>
      <div style="font-size:0.8rem;opacity:0.5">
        ${session.mode_choix === 'verrouille' ? '🔒 Verrouillé' : '🔓 Libre'} · 
        ${recettesSession.length} recette(s) · 
        ${Math.max(0, Math.ceil((new Date(session.expires_at) - new Date()) / 3600000))}h restantes
      </div>
    </div>

    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:1.25rem;text-align:center">
      <div style="font-size:0.75rem;opacity:0.5;margin-bottom:8px">QR CODE INVITÉS</div>
<img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrUrl)}" width="140" height="140" style="border-radius:8px" />
      <div style="font-size:0.7rem;opacity:0.4;margin-top:6px;word-break:break-all">${qrUrl}</div>
      <button class="btn-outline" style="margin-top:8px;padding:6px 14px;font-size:0.78rem" onclick="copierLienSession('${qrUrl}', this)">📋 Copier le lien</button>
    </div>

    <div style="font-size:0.75rem;font-weight:600;opacity:0.5;margin-bottom:10px">INVITÉS CONNECTÉS</div>
    <div id="session-invites-liste">
      <div style="font-size:0.85rem;opacity:0.4;text-align:center;padding:1rem">En attente d'invités…</div>
    </div>

    <div style="font-size:0.75rem;font-weight:600;opacity:0.5;margin:1rem 0 10px">RECETTES DISPONIBLES</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${recettesSession.map(r => `
        <span style="background:var(--bg-card);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:0.78rem;cursor:pointer"
          onclick="allerVersRecette('${r.id}')">
          ${r.nom}
        </span>
      `).join('')}
</div>
  `;
}

async function copierLienSession(url, btn) {
  await navigator.clipboard.writeText(url);
  const texteOriginal = btn.textContent;
  btn.textContent = '✅ Copié !';
  setTimeout(() => { btn.textContent = texteOriginal; }, 1500);
}

let realtimeSession = null;

function abonnerRealtimeSession(session) {
  if (realtimeSession) realtimeSession.unsubscribe();
  realtimeSession = db.channel('session-invites-' + session.token)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'sessions_invites',
      filter: `nom_session=eq.${session.nom_session}`
    }, payload => {
      chargerInvitesSession(session);
    })
    .subscribe();
  chargerInvitesSession(session);
}

async function chargerInvitesSession(session) {
  const { data: invites } = await db.from('sessions_invites')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('is_master', false)
    .eq('nom_session', session.nom_session);

  renderInvitesListe(invites || [], session);
}
function scorerRecettesPourProfil(profil, recettesCandidates) {
  const axes = ['sucre','amer','acide','fruite','fume','floral','epice','cremeux'];
  return recettesCandidates.map(r => {
    let score = 0, total = 0;
    axes.forEach(a => {
      const rv = r[`gout_${a}`] || 0;
      const pv = profil?.[a] || 0;
      if (rv > 0 || pv > 0) { score += Math.max(0, 5 - Math.abs(rv - pv)); total += 5; }
    });
    return { ...r, matchScore: total > 0 ? Math.round((score / total) * 100) : 50 };
  }).sort((a, b) => b.matchScore - a.matchScore);
}
function ouvrirAssignationCocktail(inviteId) {
  const invite = sessionActive?.invites?.find(i => i.id === inviteId) ||
    { id: inviteId }; // fallback si non trouvé localement, on relit en base au besoin

  db.from('sessions_invites').select('*').eq('id', inviteId).single().then(({ data: inv }) => {
    if (!inv) return;

    const candidats = recettes.filter(r =>
      r.type === 'cocktail' && sessionActive?.recettes_disponibles?.includes(r.id)
    );
    const scored = scorerRecettesPourProfil(inv.profil_gustatif, candidats);

const modal = document.createElement('div');
    modal.id = 'modal-assignation-cocktail';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:var(--bg-card);border-radius:16px;padding:20px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto">
        <div style="font-size:1rem;font-weight:700;margin-bottom:4px">🎁 Choisir pour ${inv.nom_invite || 'cet invité'}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:14px">Classé selon son profil gustatif</div>
        ${scored.map(r => {
          const vp = calculerVerresPossibles(r);
          const stockOk = !vp || vp.max > 0;
          return `<div class="item-alias-choix" style="padding:10px 12px;border-bottom:1px solid var(--border);${!stockOk ? 'opacity:0.4' : 'cursor:pointer'}"
            ${stockOk ? `onclick="assignerCocktailInvite('${inv.id}', '${r.id}')"` : ''}>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600">${r.nom}</span>
              <span style="color:var(--text-accent);font-size:0.8rem">${r.matchScore}% match</span>
            </div>
            <div style="font-size:0.75rem;color:${stockOk ? 'var(--text-muted)' : 'var(--text-danger)'};margin-top:2px">
              ${vp ? `🍸 ${vp.max} verre${vp.max > 1 ? 's' : ''} possible${vp.max > 1 ? 's' : ''}` : 'Stock non suivi'}
            </div>
          </div>`;
        }).join('')}
        <button class="btn-outline" style="width:100%;margin-top:14px" onclick="this.closest('div[style*=fixed]').remove()">Annuler</button>
      </div>
    `;
    document.body.appendChild(modal);
  });
}

async function assignerCocktailInvite(inviteId, recetteId) {
  await db.from('sessions_invites').update({ recette_id: recetteId, statut: 'recette_choisie' }).eq('id', inviteId);

  const inviteLocal = sessionActive?.invites?.find(i => i.id === inviteId);
  if (inviteLocal) {
    inviteLocal.recette_id = recetteId;
    inviteLocal.statut = 'recette_choisie';
  }

  // Réserve immédiatement 1 portion — un décrément réel se fera au marquerRealisee
  // le jour J, mais on protège tout de suite les assignations suivantes du même sondage.
  const recette = recettes.find(r => r.id === recetteId);
  if (recette && sessionActive) {
    for (const ing of (recette.ingredients || [])) {
      if (!ing.item_cave_id || !ing.quantite || ing.optionnel) continue;
      if (ing.unite !== 'cl' && ing.unite !== 'ml') continue;
      const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
await db.from('stock_reserve').insert({
        id: 'reserve-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        user_id: currentUser.id,
        item_id: ing.item_cave_id,
        soiree_menu_id: null,
        cl_reserve: qteCl,
        date_evenement: new Date().toISOString().slice(0, 10)
      });
    }
    await chargerStockReserve();
  }

document.getElementById('modal-assignation-cocktail')?.remove();
  renderInvitesListe(sessionActive?.invites || [], sessionActive);
  alert(`✅ "${recette?.nom}" assigné !`);
}
function renderInvitesListe(invites, session) {
  const liste = document.getElementById('session-invites-liste');
  if (!liste) return;

  if (invites.length === 0) {
    liste.innerHTML = '<div style="font-size:0.85rem;opacity:0.4;text-align:center;padding:1rem">En attente d\'invités…</div>';
    return;
  }

  const nbRepondu = invites.filter(i => i.defi_reussi !== null && i.defi_reussi !== undefined).length;
  const nbTrouve = invites.filter(i => i.defi_reussi === true).length;
  const resume = nbRepondu > 0
    ? `<div style="font-size:0.78rem;color:var(--text-accent);margin-bottom:10px;text-align:center">🎯 ${nbRepondu}/${invites.length} ont relevé le défi — ${nbTrouve} ont trouvé</div>`
    : '';

  liste.innerHTML = resume + invites.map(inv => {
    const profil = inv.profil_gustatif || {};
    const axes = Object.entries(profil).filter(([k, v]) => v > 0).map(([k, v]) => k).join(' · ') || '—';
    const recette = inv.recette_id ? recettes.find(r => r.id === inv.recette_id)?.nom || inv.recette_id : '—';

    let badgeDefi = '';
    if (inv.defi_reussi === true) badgeDefi = `<span style="font-size:0.72rem;color:var(--text-success)">🎯 ✅ Trouvé</span>`;
    else if (inv.defi_reussi === false) badgeDefi = `<span style="font-size:0.72rem;color:var(--text-muted)">🎯 ❌ Pas trouvé</span>`;

    return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-weight:600">${inv.nom_invite || 'Invité'}</div>
          <span style="font-size:0.75rem;opacity:0.5">${inv.choix_type === 'seb' ? '✨ Laisse Seb choisir' : '🍸 A choisi'}</span>
        </div>
        <div style="font-size:0.78rem;opacity:0.5;margin-bottom:8px">Profil : ${axes}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:0.82rem">Cocktail : <strong>${recette}</strong></div>
          ${badgeDefi}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-primary" style="flex:1;font-size:0.78rem" 
            onclick="lancerJeu('${inv.id}', 'degustation')">🍸 Dégustation</button>
          <button class="btn-primary" style="flex:1;font-size:0.78rem;background:transparent;border:1px solid var(--border)" 
            onclick="lancerJeu('${inv.id}', 'devine')">🔍 Devine</button>
        </div>
        ${inv.recette_id ? `
        <button style="width:100%;margin-top:8px;padding:8px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-size:0.82rem"
          onclick="allerVersRecette('${inv.recette_id}')">→ Voir la recette</button>
        ` : ''}
      </div>
    `;
  }).join('');
}
async function lancerJeu(inviteId, jeu) {
  await db.from('sessions_invites')
    .update({ jeu_actif: jeu })
    .eq('id', inviteId);
}



function allerVersRecette(id) {
  document.getElementById('modal-session-active').classList.remove('visible');
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
  document.querySelector('nav button[data-tab="recettes"]').classList.add('active');
  document.getElementById('section-recettes').classList.remove('hidden');
  sectionRecette = 'cocktail';
  ouvrirFicheRecette(id);
}

let sessionActive = null;
// =============================================
// RECHARGEMENT ANECDOTE / CONSEIL
// =============================================
 
async function rechargerAnecdote() {
  const btn = document.querySelector('[onclick="rechargerAnecdote()"]');
  if (btn) btn.style.opacity = '0.4';
  const { data } = await db.from('anecdotes').select('*');
  const el = document.getElementById('dash-anecdote-texte');
  if (el && data?.length) el.textContent = data[Math.floor(Math.random() * data.length)].texte;
  if (btn) btn.style.opacity = '1';
}

async function rechargerConseil() {
  const btn = document.querySelector('[onclick="rechargerConseil()"]');
  if (btn) btn.style.opacity = '0.4';
  const { data } = await db.from('conseils').select('*');
  const el = document.getElementById('dash-conseil-texte');
  if (el && data?.length) {
    const item = data[Math.floor(Math.random() * data.length)];
    el.textContent = item.texte;
  }
  if (btn) btn.style.opacity = '1';
}
let filtreHerboFamille = '';
let filtreHerboUsage = '';
let plantesList = [];
let plantesOuverte = null;

async function chargerHerboristerie() {
  const container = document.getElementById('herboristerie-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Chargement…</div>';
  const { data: plantes } = await db.from('plantes').select('*').order('nom');
  if (!plantes) return;
  plantesList = plantes;
  renderHerboristerie(plantes);
}

function renderHerboristerie(plantes) {
  const container = document.getElementById('herboristerie-container');
  if (!container) return;
  const familles = [...new Set(plantes.map(p => p.famille).filter(Boolean))];
  const usages   = [...new Set(plantes.flatMap(p => p.usages_bar || []))].sort();
  let liste = plantes;
  if (filtreHerboFamille) liste = liste.filter(p => p.famille === filtreHerboFamille);
  if (filtreHerboUsage)   liste = liste.filter(p => p.usages_bar?.includes(filtreHerboUsage));
  const familleLabel = { aromatique: 'Aromatiques', fleur: 'Fleurs', epice: 'Épices', agrume: 'Agrumes', autre: 'Autres' };
  const usageLabel   = { decoration: 'Déco', infusion: 'Infusion', maceration: 'Macération', sirop: 'Sirop', muddle: 'Muddle', zeste: 'Zeste' };
  container.innerHTML = `
    <div class="herbo-filtres">
      <button class="herbo-filtre-btn ${!filtreHerboFamille && !filtreHerboUsage ? 'active' : ''}"
        onclick="filtreHerboFamille=''; filtreHerboUsage=''; renderHerboristerie(plantesList)">Toutes</button>
      ${familles.map(f => `
        <button class="herbo-filtre-btn ${filtreHerboFamille === f ? 'active' : ''}"
          onclick="filtreHerboFamille='${f}'; filtreHerboUsage=''; renderHerboristerie(plantesList)">
          ${familleLabel[f] || f}
        </button>`).join('')}
      <span class="herbo-filtre-sep">|</span>
      ${usages.map(u => `
        <button class="herbo-filtre-btn herbo-filtre-usage ${filtreHerboUsage === u ? 'active' : ''}"
          onclick="filtreHerboUsage='${u}'; filtreHerboFamille=''; renderHerboristerie(plantesList)">
          ${usageLabel[u] || u}
        </button>`).join('')}
    </div>
    <div class="herbo-grille">
      ${liste.length === 0 ? '<div class="empty-state">Aucune plante trouvée.</div>' : ''}
      ${liste.map(p => renderCartePlante(p)).join('')}
    </div>
  `;
}

function switchSousOngletConc(panel, btn) {
  document.querySelectorAll('.conc-sous-onglet').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('conc-panel-en-cours').style.display = panel === 'en-cours' ? '' : 'none';
  document.getElementById('conc-panel-grimoire').style.display = panel === 'grimoire' ? '' : 'none';
  document.getElementById('conc-panel-lexique').style.display = panel === 'lexique' ? '' : 'none';
  if (panel === 'lexique') chargerLexiqueConc();
  if (panel === 'grimoire') chargerGrimoire();
}

// =============================================
// CARTE PLANTE
// =============================================
// =============================================
// INSPIRATIONS
// =============================================

let inspirationsList = [];
let inspiSourceActive = 'manuel';
// Technique suggérée par défaut quand rien n'est visible sur le screenshot —
// même logique qu'Alexis applique ailleurs : shake si agrumes/œuf/lactés, sinon stir.
function suggererTechniqueParDefaut(ingredients) {
  const noms = (ingredients || []).map(i => (i.nom || '').toLowerCase()).join(' ');
  const aAgrumesOuTexture = /citron|lime|orange|pamplemousse|œuf|oeuf|creme|cream|lait|milk|ananas|pineapple/.test(noms);
  const aSodaOuTonic = /soda|tonic|ginger|eau gazeuse|champagne|prosecco|club soda/.test(noms);

  if (aSodaOuTonic) return 'Suggestion : construction directe dans le verre, sur glace (à vérifier — non lu sur l\'image).';
  if (aAgrumesOuTexture) return 'Suggestion : shaker avec glace 10-15 secondes, puis filtrer (à vérifier — non lu sur l\'image).';
  return 'Suggestion : mélanger au verre à mélange (stir) 30 secondes, puis filtrer (à vérifier — non lu sur l\'image).';
}
async function analyserScreenshot(input) {
  const file = input.files[0];
  if (!file) return;

  const btn = document.querySelector('[onclick*="screenshot-input"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyse…'; }

  try {
    // Compression côté client (même pattern que réalisations/concoctions)
    const blob = await new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 1280;
        let w = img.width, h = img.height;
        if (w > max) { h = Math.round(h * max / w); w = max; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(b => { resolve(b); URL.revokeObjectURL(url); }, 'image/jpeg', 0.85);
      };
      img.src = url;
    });

    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });

    // Upload du screenshot dans le même bucket que les autres photos d'inspiration —
    // permet de revérifier visuellement ce que l'IA a lu, en cas de doute.
    let photo_url = null;
    const path = `inspirations/${currentUser.id}/${Date.now()}.jpg`;
    const { error: uploadError } = await db.storage.from('photos-inspirations').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (!uploadError) {
      const { data: urlData } = db.storage.from('photos-inspirations').getPublicUrl(path);
      photo_url = urlData.publicUrl;
    }

    const res = await fetch('/api/lire-recette', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64 })
    });
    const data = await res.json();

    if (data.error) { alert('Erreur : ' + data.error); return; }

    const recettesTrouvees = data.recettes || [];
    if (recettesTrouvees.length === 0) {
      alert('Aucune recette lisible sur ce screenshot.');
      return;
    }

    for (const r of recettesTrouvees) {
      await db.from('inspirations').insert({
        id: 'screenshot-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        user_id: currentUser.id,
        nom: r.nom || 'Cocktail screenshot',
        source: 'photo',
        source_detail: 'Screenshot',
        photo_url,
        ingredients: r.ingredients || [],
        statut: 'en_attente',
        notes: JSON.stringify({
          type: 'cocktail',
          verre: r.verre || null,
          garniture: r.garniture || null,
          methode: (r.methode && r.methode.length) ? r.methode : suggererTechniqueParDefaut(r.ingredients),
          methode_source: (r.methode && r.methode.length) ? 'lue sur l\'image' : 'suggérée par défaut',
          complements: r.complements || null,
          base_alcool: r.base_alcool || null,
          origine: 'Importé via screenshot'
        })
      });
    }

    await chargerInspirations();
    alert(recettesTrouvees.length === 1
      ? '✅ Recette "' + (recettesTrouvees[0].nom || 'Cocktail') + '" ajoutée dans Inspirations !'
      : `✅ ${recettesTrouvees.length} recettes ajoutées dans Inspirations !`);

  } catch (e) {
    alert('Erreur réseau : ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📷 Screenshot recette'; }
    input.value = '';
  }
}
async function chargerInspirations() {
  const container = document.getElementById('inspirations-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Chargement…</div>';
  const { data } = await db.from('inspirations').select('*').order('created_at', { ascending: false });
  inspirationsList = data || [];
  renderInspirations();
}

let inspirationsSelectionRejetees = new Set();

function renderInspirations() {
  const container = document.getElementById('inspirations-container');
  if (!container) return;

  const enAttente = inspirationsList.filter(i => i.statut === 'en_attente');
  const validees = inspirationsList.filter(i => i.statut === 'validee');
  const rejetees = inspirationsList.filter(i => i.statut === 'rejetee');

container.innerHTML = `
<div style="padding:1rem;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">
  <button class="btn-outline" onclick="captureRapideBartender()">📱 Dévoile ton cocktail</button>
  <button class="btn-outline" onclick="ouvrirLaTournee()">🍹 La Tournée</button>
<button class="btn-outline" onclick="ouvrirImportURL()">🔗 Importer URL</button>
  <button class="btn-outline" onclick="document.getElementById('screenshot-input').click()">📷 Screenshot recette</button>
  <input type="file" id="screenshot-input" accept="image/*" style="display:none" onchange="analyserScreenshot(this)">
  <button class="btn-primary" onclick="afficherModal('modal-ajout-inspiration'); peuplerDatalistCaveItems(); if(!document.getElementById('inspi-ingredients-rows').children.length) ajouterLigneIngredientInspi();">+ Ajouter</button>
</div>

    ${enAttente.length > 0 ? `
    <div class="conc-section">
      <h3 class="conc-section-titre">⏳ En attente (${enAttente.length})</h3>
      <div class="herbo-grille">
        ${enAttente.map(i => renderCarteInspiration(i)).join('')}
      </div>
    </div>` : ''}

    ${validees.length > 0 ? `
    <div class="conc-section">
      <h3 class="conc-section-titre">✅ Validées (${validees.length})</h3>
      <div class="herbo-grille">
        ${validees.map(i => renderCarteInspiration(i)).join('')}
      </div>
    </div>` : ''}

    ${rejetees.length > 0 ? `
    <div class="conc-section">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3 class="conc-section-titre">❌ Rejetées (${rejetees.length})</h3>
        ${inspirationsSelectionRejetees.size > 0 ? `
        <button class="btn-outline" style="color:var(--text-danger);border-color:var(--border-danger)" onclick="supprimerInspirationsSelectionnees()">
          🗑 Supprimer la sélection (${inspirationsSelectionRejetees.size})
        </button>` : ''}
      </div>
      <div class="herbo-grille">
        ${rejetees.map(i => renderCarteInspiration(i, true)).join('')}
      </div>
    </div>` : ''}

    ${inspirationsList.length === 0 ? `
    <div class="empty-state">
      <div class="empty-state-icon">💡</div>
      <div>Aucune inspiration enregistrée.</div>
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:6px">Ajoutez des recettes croisées en déplacement.</div>
    </div>` : ''}
  `;
}

function toggleSelectionInspirationRejetee(id, event) {
  event.stopPropagation();
  if (inspirationsSelectionRejetees.has(id)) inspirationsSelectionRejetees.delete(id);
  else inspirationsSelectionRejetees.add(id);
  renderInspirations();
}

async function supprimerInspirationsSelectionnees() {
  const ids = Array.from(inspirationsSelectionRejetees);
  if (!ids.length) return;
  if (!confirm(`Supprimer définitivement ${ids.length} inspiration${ids.length > 1 ? 's' : ''} rejetée${ids.length > 1 ? 's' : ''} ? Cette action est irréversible.`)) return;

  const { error } = await db.from('inspirations').delete().in('id', ids).eq('user_id', currentUser.id);
  if (error) { alert('Erreur : ' + error.message); return; }

  inspirationsList = inspirationsList.filter(x => !ids.includes(x.id));
  inspirationsSelectionRejetees.clear();
  renderInspirations();
}
async function captureRapideBartender() {
  const now = new Date();
  const nom = `Cocktail du ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  const id = 'inspi-' + Date.now();

  const { data, error } = await db.from('inspirations').insert({
    id,
    user_id: currentUser.id,
    nom,
    source: 'manuel',
    source_detail: 'Capture rapide bar',
    ingredients: [],
    tags: [],
    statut: 'en_attente'
  }).select().single();

  if (error || !data) { alert('Erreur : ' + (error?.message || 'inconnue')); return; }

  inspirationsList.unshift(data);
  renderInspirations();
  ouvrirQRBartender(data.id);
}
function ouvrirLaTournee() {
  const url = window.location.origin + '/tournee.html';
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:24px;max-width:360px;width:100%;text-align:center;">
      <div style="font-size:1.3rem;font-weight:700;margin-bottom:6px;">🍹 La Tournée</div>
      <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:20px;">Partage ce lien ou ce QR code à tes amis pour qu'ils t'envoient leurs recettes.</div>
      <div id="qr-tournee" style="display:inline-block;border-radius:8px;overflow:hidden;margin-bottom:16px;"></div>
      <div style="font-size:0.75rem;color:var(--text-muted);word-break:break-all;margin-bottom:16px;">${url}</div>
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <button id="btn-copier-tournee" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);cursor:pointer;font-size:0.85rem;">
          📋 Copier le lien
        </button>
        <button id="btn-partager-tournee" style="flex:1;padding:10px;border-radius:8px;border:none;background:var(--accent);color:#000;cursor:pointer;font-size:0.85rem;font-weight:600;">
          📤 Partager
        </button>
      </div>
      <button id="btn-fermer-tournee" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-muted);cursor:pointer;font-size:0.85rem;">
        Fermer
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  // Events
  document.getElementById('btn-copier-tournee').onclick = () => {
    navigator.clipboard.writeText(url).then(() => alert('✅ Lien copié !'));
  };
  document.getElementById('btn-partager-tournee').onclick = () => {
    if (navigator.share) navigator.share({ title: 'La Tournée', url });
    else navigator.clipboard.writeText(url).then(() => alert('✅ Lien copié !'));
  };
  document.getElementById('btn-fermer-tournee').onclick = () => modal.remove();

  // QR Code
  if (typeof QRCode !== 'undefined') {
    new QRCode(document.getElementById('qr-tournee'), {
      text: url, width: 200, height: 200,
      colorDark: '#000000', colorLight: '#ffffff'
    });
  }
}
 // Liste toutes les bouteilles de la cave (normale ou voyage), dédoublonnées
function listeToutesLesBouteilles() {
  const bouteilles = voyageActif
    ? voyageBouteillesActives
    : cave?.categories?.flatMap(c => c.items).filter(i => i.detenu !== false) || [];
  const vues = new Set();
  return bouteilles
    .map(b => ({ id: voyageActif ? b.item_cave_id : b.id, nom: b.nom }))
    .filter(ing => { if (vues.has(ing.id)) return false; vues.add(ing.id); return true; })
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

async function ouvrirImportURL() {
  const url = prompt('Colle l\'URL de la page à scraper (ex: https://disaronno.com/fr/mix-with-style/)');
  if (!url) return;

  const btn = document.querySelector('[onclick="ouvrirImportURL()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyse…'; }

  try {
    const res = await fetch('/api/tavily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();

    if (data.error) { alert('Erreur : ' + data.error); return; }
    if (!data.recettes || data.recettes.length === 0) { alert('Aucune recette détectée sur cette page.'); return; }

    // Afficher les recettes détectées dans un modal
   ouvrirModalImportRecettes(data.recettes, url, data._meta?.images || []);

  } catch(e) {
    alert('Erreur réseau : ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔗 Importer URL'; }
  }
}

function ouvrirModalImportRecettes(recettes, urlSource, images = []) {
  const existing = document.getElementById('modal-import-recettes');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-import-recettes';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto;';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:24px;max-width:520px;width:100%;max-height:80vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:1.1rem;font-weight:700">${recettes.length} recette${recettes.length > 1 ? 's' : ''} détectée${recettes.length > 1 ? 's' : ''}</div>
        <button onclick="document.getElementById('modal-import-recettes').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer">✕</button>
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:16px;word-break:break-all">${urlSource}</div>

      ${images.length > 0 ? `
      <div style="margin-bottom:16px">
        <div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px">📷 Choisis une photo pour ces recettes (optionnel) :</div>
        <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">
          ${images.map((img, i) => `
            <img src="${img}" id="import-img-${i}" onclick="choisirPhotoImport('${img.replace(/'/g, "\\'")}', ${i})"
              style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:2px solid var(--border);cursor:pointer;flex-shrink:0">
          `).join('')}
        </div>
      </div>` : ''}

      <div style="margin-bottom:16px">
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">${images.length > 0 ? 'Pas la bonne photo ?' : 'Aucune photo détectée automatiquement.'} Colle une URL d'image à la place :</div>
        <input type="text" id="import-photo-manuelle" placeholder="https://..." style="width:100%;font-size:0.8rem" onchange="majPhotoManuelle(this)">
      </div>

      <div style="display:flex;flex-direction:column;gap:10px">
        ${recettes.map((r, i) => `
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
              <div style="font-weight:600;font-size:0.9rem">${r.nom}</div>
             <button onclick="importerRecette(${i}, this)" 
  style="background:var(--accent);color:#000;border:none;border-radius:6px;padding:4px 10px;font-size:0.78rem;font-weight:600;cursor:pointer;white-space:nowrap;margin-left:8px">
  + Importer
</button>
            </div>
            <div style="font-size:0.78rem;color:var(--text-secondary)">
              ${r.ingredients?.slice(0,4).map(ing => `${ing.quantite || ''}${ing.unite || ''} ${ing.nom}`).join(' · ')}${r.ingredients?.length > 4 ? ` +${r.ingredients.length - 4}` : ''}
            </div>
            ${r.verre ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">🥃 ${r.verre}</div>` : ''}
          </div>
        `).join('')}
      </div>
      <button onclick="importerToutesRecettes(${recettes.length})" 
        style="width:100%;margin-top:16px;padding:12px;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-primary);cursor:pointer;font-size:0.85rem;">
        ✅ Importer toutes les recettes
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  // Stocker les recettes pour l'import
  window._recettesImport = recettes;
  window._urlImport = urlSource;
  window._photoImportChoisie = null;
}

function choisirPhotoImport(url, index) {
  window._photoImportChoisie = (window._photoImportChoisie === url) ? null : url;
  document.querySelectorAll('[id^="import-img-"]').forEach((el, i) => {
    el.style.borderColor = (window._photoImportChoisie && i === index) ? 'var(--accent)' : 'var(--border)';
  });
  const champManuel = document.getElementById('import-photo-manuelle');
  if (champManuel) champManuel.value = '';
}

function majPhotoManuelle(input) {
  window._photoImportChoisie = input.value.trim() || null;
  document.querySelectorAll('[id^="import-img-"]').forEach(el => { el.style.borderColor = 'var(--border)'; });
}

async function importerRecette(index, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  await _creerInspirationDepuisImport(window._recettesImport[index]);
  if (btn) { btn.textContent = '✅'; btn.style.background = 'var(--bg-success)'; btn.style.color = 'var(--text-success)'; }
  await chargerInspirations();
}

async function importerToutesRecettes(total) {
  for (let i = 0; i < total; i++) {
    await _creerInspirationDepuisImport(window._recettesImport[i]);
  }
  document.getElementById('modal-import-recettes')?.remove();
  await chargerInspirations();
  alert(`✅ ${total} recettes importées dans Inspirations !`);
}

async function _creerInspirationDepuisImport(r) {
  const domaine = new URL(window._urlImport).hostname.replace('www.', '');
  await db.from('inspirations').insert({
    id: 'import-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    user_id: currentUser.id,
    nom: r.nom,
    source: 'url',
    source_detail: domaine,
    photo_url: window._photoImportChoisie || null,
    ingredients: r.ingredients || [],
    statut: 'en_attente',
    notes: JSON.stringify({
      type: 'cocktail',
      verre: r.verre || null,
      garniture: r.garniture || null,
      methode: r.methode || null,
      complements: r.complements || null,
     base_alcool: r.base_alcool || null
    })
  });
}
function renderCarteInspiration(inspi, avecCheckbox = false) {
  const ings = Array.isArray(inspi.ingredients) ? inspi.ingredients : [];
  const tags = inspi.tags || [];
  const dateStr = new Date(inspi.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const sourceIcon = { manuel: '✍️', photo: '📷', url: '🔗', tournee: '🍻' };

  // Parser les notes La Tournée
  let notesTournee = {};
  if (inspi.source === 'tournee' && inspi.notes) {
    try { notesTournee = JSON.parse(inspi.notes); } catch(e) {}
  }

const coche = inspirationsSelectionRejetees.has(inspi.id);
  return `
    <div class="herbo-carte" style="position:relative" onclick="ouvrirFicheInspiration('${inspi.id}')">
      ${avecCheckbox ? `
      <input type="checkbox" ${coche ? 'checked' : ''} onclick="toggleSelectionInspirationRejetee('${inspi.id}', event)"
        style="position:absolute;top:8px;right:8px;width:20px;height:20px;z-index:2;cursor:pointer">
      ` : ''}
${(() => {
        if (!inspi.photo_url) return '';
        const c = inspi.photo_cadrage || { zoom: 1, x: 0, y: 0 };
        return `<div style="position:relative;width:100%;height:120px;overflow:hidden;border-radius:8px;background:#000;margin-bottom:8px">
          <img src="${inspi.photo_url}" style="position:absolute;top:50%;left:50%;width:100%;height:auto;max-width:none;
          transform:translate(calc(-50% + ${c.x}%), calc(-50% + ${c.y}%)) scale(${c.zoom});">
        </div>`;
      })()}
      <div class="herbo-carte-top">
        <span class="herbo-emoji">${sourceIcon[inspi.source] || '💡'}</span>
        <div class="herbo-carte-info">
          <div class="herbo-nom">${inspi.nom}</div>
          ${inspi.source === 'tournee' && notesTournee.prenom ? 
            `<div class="herbo-latin">🍻 De ${notesTournee.prenom}</div>` : 
            inspi.source_detail ? `<div class="herbo-latin">${inspi.source_detail}</div>` : ''}
        </div>
        <span class="herbo-saison ${inspi.statut === 'en_attente' ? 'herbo-saison--off' : inspi.statut === 'validee' ? 'herbo-saison--ok' : ''}">
          ${inspi.statut === 'en_attente' ? '⏳' : inspi.statut === 'validee' ? '✅' : '❌'}
        </span>
      </div>
      ${inspi.source === 'tournee' && notesTournee.origine ? `
      <div style="font-size:0.78rem;font-style:italic;color:var(--text-muted);margin-top:6px;line-height:1.4">
        💬 "${notesTournee.origine}"
      </div>` : ''}
      ${ings.length > 0 ? `
      <div class="herbo-profil" style="margin-top:6px">
       ${ings.slice(0, 3).map(ing => {
  if (typeof ing === 'string') return ing;
  const q = ing.quantite ? ing.quantite + (ing.unite || 'cl') + ' ' : '';
  return q + ing.nom;
}).join(' · ')}
      </div>` : ''}
      <div class="herbo-usages" style="margin-top:6px">
        ${tags.map(t => `<span class="herbo-usage-tag">${t}</span>`).join('')}
        <span class="herbo-usage-tag" style="opacity:0.5">${dateStr}</span>
      </div>
      ${inspi.analyse_result ? `
      <div style="margin-top:8px;font-size:0.75rem;padding:4px 8px;border-radius:6px;background:var(--bg-accent);color:var(--text-accent)">
       ${inspi.analyse_result.type === 'nouvelle' ? '🆕 Nouvelle recette' : inspi.analyse_result.recette_similaire ? `🔄 Variante de ${inspi.analyse_result.recette_similaire}` : '🔄 Recette similaire existante'}
      </div>` : ''}
    </div>
  `;
}

function selectInspiSource(btn) {
  document.querySelectorAll('#inspi-source-btns .config-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  inspiSourceActive = btn.dataset.source;
  document.getElementById('inspi-photo-group').style.display = inspiSourceActive === 'photo' ? '' : 'none';
  document.getElementById('inspi-url-group').style.display = inspiSourceActive === 'url' ? '' : 'none';
}
function peuplerDatalistCaveItems() {
  const datalist = document.getElementById('datalist-cave-items');
  if (!datalist) return;
  const noms = (cave?.categories?.flatMap(c => c.items) || []).map(i => i.nom);
  datalist.innerHTML = noms.map(n => `<option value="${n}">`).join('');
}
function ajouterLigneIngredientInspi(nom = '', quantite = '', unite = 'cl') {
  const container = document.getElementById('inspi-ingredients-rows');
  const rowId = 'row-ing-' + Date.now() + Math.random().toString(36).slice(2, 6);
  const row = document.createElement('div');
  row.id = rowId;
  row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center';
  row.innerHTML = `
    <input type="text" class="ing-nom" placeholder="Ingrédient" value="${nom}" style="flex:2" list="datalist-cave-items">
    <input type="number" step="0.1" class="ing-quantite" placeholder="Qté" value="${quantite}" style="flex:0.8">
    <select class="ing-unite" style="flex:0.8">
      <option value="cl" ${unite === 'cl' ? 'selected' : ''}>cl</option>
      <option value="ml" ${unite === 'ml' ? 'selected' : ''}>ml</option>
      <option value="traits" ${unite === 'traits' ? 'selected' : ''}>traits</option>
      <option value="pièce" ${unite === 'pièce' ? 'selected' : ''}>pièce</option>
    </select>
    <button type="button" class="btn-icon" style="color:var(--text-danger)" onclick="document.getElementById('${rowId}').remove()">✕</button>
  `;
  container.appendChild(row);
}

function lireLignesIngredientsInspi() {
  const rows = document.querySelectorAll('#inspi-ingredients-rows > div');
  const result = [];
  rows.forEach(row => {
    const nom = row.querySelector('.ing-nom').value.trim();
    if (!nom) return;
    const quantite = row.querySelector('.ing-quantite').value.trim();
    const unite = row.querySelector('.ing-unite').value;
    result.push({
      nom,
      quantite: quantite ? parseFloat(quantite) : null,
      unite: quantite ? unite : null
    });
  });
  return result;
}
async function sauverInspiration() {
  const nom = document.getElementById('inspi-nom').value.trim();
  if (!nom) return;

const ingredients = lireLignesIngredientsInspi();
  const tagsRaw = document.getElementById('inspi-tags').value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  let photo_url = null;
  const photoInput = document.getElementById('inspi-photo-input');
  if (inspiSourceActive === 'photo' && photoInput.files[0]) {
    const file = photoInput.files[0];
    const ext = file.name.split('.').pop();
    const path = `inspirations/${currentUser.id}/${Date.now()}.${ext}`;
    const { error } = await db.storage.from('photos-inspirations').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = db.storage.from('photos-inspirations').getPublicUrl(path);
      photo_url = data.publicUrl;
    }
  }

  const id = 'inspi-' + Date.now();
  const { data } = await db.from('inspirations').insert({
    id,
    user_id: currentUser.id,
    nom,
    source: inspiSourceActive,
    source_detail: document.getElementById('inspi-source-detail').value.trim() || null,
    ingredients,
    tags,
    notes: document.getElementById('inspi-notes').value.trim() || null,
    photo_url,
    statut: 'en_attente'
  }).select().single();

  if (data) {
    inspirationsList.unshift(data);
    fermerModal('modal-ajout-inspiration');
    // Reset form
    document.getElementById('inspi-nom').value = '';
    document.getElementById('inspi-ingredients-rows').innerHTML = '';
    ajouterLigneIngredientInspi();
    document.getElementById('inspi-tags').value = '';
    document.getElementById('inspi-notes').value = '';
    document.getElementById('inspi-source-detail').value = '';
    renderInspirations();
  }
}
async function associerPhotoInspiration(id) {
  const input = document.getElementById(`inspi-photo-manuelle-${id}`);
  const url = input?.value?.trim();
  if (!url) { alert('Colle une URL de photo d\'abord.'); return; }

  const { error } = await db.from('inspirations').update({ photo_url: url }).eq('id', id).eq('user_id', currentUser.id);
  if (error) { alert('Erreur : ' + error.message); return; }

  const idx = inspirationsList.findIndex(x => x.id === id);
  if (idx !== -1) inspirationsList[idx].photo_url = url;

  renderInspirations();
  await ouvrirFicheInspiration(id);
}
async function sauvegarderNomInspiration(id, nouveauNom) {
  const nom = (nouveauNom || '').trim();
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi || !nom || nom === inspi.nom) return;
  await db.from('inspirations').update({ nom }).eq('id', id).eq('user_id', currentUser.id);
  inspi.nom = nom;
  renderInspirations();
}

function ouvrirRecadragePhoto(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi || !inspi.photo_url) return;

  let cadrage = { ...(inspi.photo_cadrage || { zoom: 1, x: 0, y: 0 }) };
  let dragging = false, startX = 0, startY = 0, startCadrageX = 0, startCadrageY = 0;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:20px;max-width:420px;width:100%">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px">🎯 Ajuster le cadrage</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px">Glissez la photo pour la repositionner. Le cadre gris pointillé représente les limites visibles.</div>
      <div id="cadrage-frame" style="position:relative;width:100%;height:220px;overflow:hidden;border-radius:12px;background:#000;border:2px dashed var(--border-accent);cursor:grab;touch-action:none">
        <img id="cadrage-img" src="${inspi.photo_url}" draggable="false"
          style="position:absolute;top:50%;left:50%;width:100%;height:auto;max-width:none;user-select:none;
          transform:translate(calc(-50% + ${cadrage.x}%), calc(-50% + ${cadrage.y}%)) scale(${cadrage.zoom})">
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
        <span style="font-size:0.8rem;color:var(--text-secondary)">🔍−</span>
        <input type="range" id="cadrage-zoom" min="30" max="250" value="${Math.round(cadrage.zoom * 100)}" style="flex:1">
        <span style="font-size:0.8rem;color:var(--text-secondary)">🔍+</span>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);text-align:center;margin-top:2px">Zoom : ${Math.round(cadrage.zoom * 100)}% — sous 100%, des bandes noires apparaissent</div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button id="btn-cadrage-annuler" class="btn-outline" style="flex:1">Annuler</button>
        <button id="btn-cadrage-valider" class="btn-primary" style="flex:1">✅ Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const frame = document.getElementById('cadrage-frame');
  const img = document.getElementById('cadrage-img');
  const zoomInput = document.getElementById('cadrage-zoom');
  const zoomLabel = modal.querySelector('div[style*="text-align:center"]');

  function appliquer() {
    img.style.transform = `translate(calc(-50% + ${cadrage.x}%), calc(-50% + ${cadrage.y}%)) scale(${cadrage.zoom})`;
    zoomLabel.textContent = `Zoom : ${Math.round(cadrage.zoom * 100)}% — sous 100%, des bandes noires apparaissent`;
  }

  zoomInput.oninput = () => {
    cadrage.zoom = zoomInput.value / 100;
    appliquer();
  };

  function pointerDown(e) {
    dragging = true;
    frame.style.cursor = 'grabbing';
    const p = e.touches ? e.touches[0] : e;
    startX = p.clientX; startY = p.clientY;
    startCadrageX = cadrage.x; startCadrageY = cadrage.y;
  }
  function pointerMove(e) {
    if (!dragging) return;
    const p = e.touches ? e.touches[0] : e;
    const rect = frame.getBoundingClientRect();
    const dx = ((p.clientX - startX) / rect.width) * 100;
    const dy = ((p.clientY - startY) / rect.height) * 100;
    cadrage.x = startCadrageX + dx;
    cadrage.y = startCadrageY + dy;
    appliquer();
  }
  function pointerUp() { dragging = false; frame.style.cursor = 'grab'; }

  frame.addEventListener('mousedown', pointerDown);
  frame.addEventListener('mousemove', pointerMove);
  window.addEventListener('mouseup', pointerUp);
  frame.addEventListener('touchstart', pointerDown, { passive: true });
  frame.addEventListener('touchmove', pointerMove, { passive: true });
  frame.addEventListener('touchend', pointerUp);

document.getElementById('btn-cadrage-annuler').onclick = () => { window.removeEventListener('mouseup', pointerUp); modal.remove(); };
  document.getElementById('btn-cadrage-valider').onclick = async () => {
    await db.from('inspirations').update({ photo_cadrage: cadrage }).eq('id', id).eq('user_id', currentUser.id);
    inspi.photo_cadrage = cadrage;
    window.removeEventListener('mouseup', pointerUp);
    modal.remove();
    ouvrirFicheInspiration(id);
  };
}
function statutIngredientPreview(nomIng) {
  const nomLower = (nomIng || '').toLowerCase().trim();

  if (ingredientsAlias[nomLower]) {
    const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === ingredientsAlias[nomLower]);
    if (item) return item.detenu !== false ? 'ok' : 'manquant';
  }

  const gLie = glossaireIngredients.find(g => g.item_cave_id && (
    g.nom_canonique.toLowerCase() === nomLower || (g.alias || []).some(a => a.toLowerCase() === nomLower)
  ));
  if (gLie) {
    const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === gLie.item_cave_id);
    if (item) return item.detenu !== false ? 'ok' : 'manquant';
  }

  const autoId = trouverItemCaveCorrespondant(nomIng);
  if (autoId) {
    const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === autoId);
    if (item) return item.detenu !== false ? 'ok' : 'manquant';
  }

  const gConnu = glossaireIngredients.find(g =>
    g.nom_canonique.toLowerCase() === nomLower || (g.alias || []).some(a => a.toLowerCase() === nomLower)
  );
  if (gConnu) return 'glossaire';

  return 'inconnu';
}

function badgeStatutIngredientInspiration(statut) {
  const map = {
    ok:        { icon: '✅', label: 'En cave',  color: 'var(--text-success)' },
    manquant:  { icon: '❌', label: 'Manquant', color: 'var(--text-danger)' },
    glossaire: { icon: '🧪', label: 'Connu',    color: 'var(--text-accent)' },
    inconnu:   { icon: '❓', label: 'Inconnu',  color: 'var(--text-muted)' }
  };
  const s = map[statut];
  return `<span style="font-size:0.72rem;color:${s.color};white-space:nowrap">${s.icon} ${s.label}</span>`;
}
async function ouvrirFicheInspiration(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;

  const ings = Array.isArray(inspi.ingredients) ? inspi.ingredients : [];
  const tags = inspi.tags || [];
  const dateStr = new Date(inspi.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const sourceLabel = { manuel: 'Saisie manuelle', photo: 'Photo', url: 'URL' };

  const { data: reponsesBartender } = await db.from('bartender_reponses').select('*').eq('inspiration_id', id).order('created_at', { ascending: false });

const cadrage = inspi.photo_cadrage || { zoom: 1, x: 0, y: 0 };

  document.getElementById('inspiration-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2rem">💡</span>
      <div style="flex:1">
        <input type="text" id="inspi-nom-input-${inspi.id}" value="${inspi.nom}" class="fiche-titre"
          style="font-family:inherit;background:none;border:none;border-bottom:1px dashed var(--border);color:inherit;width:100%;padding:2px 0"
          onblur="sauvegarderNomInspiration('${inspi.id}', this.value)"
          onkeydown="if(event.key==='Enter') this.blur()">
        <div class="herbo-latin">${sourceLabel[inspi.source] || ''} ${inspi.source_detail ? '· ' + inspi.source_detail : ''} · ${dateStr}</div>
      </div>
    </div>

${inspi.photo_url ? `
<div style="position:relative;width:100%;height:220px;overflow:hidden;border-radius:12px;background:#000;margin-bottom:4px">
  <img id="inspi-photo-${inspi.id}" src="${inspi.photo_url}"
    style="position:absolute;top:50%;left:50%;width:100%;height:auto;max-width:none;
    transform:translate(calc(-50% + ${cadrage.x}%), calc(-50% + ${cadrage.y}%)) scale(${cadrage.zoom});">
</div>
<button class="btn-outline" style="font-size:0.78rem;padding:6px 12px;margin-bottom:16px" onclick="ouvrirRecadragePhoto('${inspi.id}')">🎯 Ajuster le cadrage</button>
` : ''}

<div class="plante-section" style="display:flex;gap:8px;align-items:center">
  <input type="text" id="inspi-photo-manuelle-${inspi.id}" placeholder="Coller une URL de photo…" style="flex:1;font-size:0.8rem">
  <button class="btn-outline" style="white-space:nowrap;padding:8px 12px;font-size:0.78rem" onclick="associerPhotoInspiration('${inspi.id}')">${inspi.photo_url ? '🔄 Changer' : '📷 Ajouter'}</button>
</div>

<div class="plante-section" id="inspi-video-zone-${inspi.id}">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <input type="text" id="inspi-video-input-${inspi.id}" placeholder="Coller un lien vidéo (YouTube, TikTok...)" value="${inspi.video_url || ''}" style="flex:1;font-size:0.8rem">
        <button class="btn-outline" style="white-space:nowrap;padding:8px 12px;font-size:0.78rem" onclick="associerVideoInspiration('${inspi.id}')">${inspi.video_url ? '🔄 Changer' : '🎬 Ajouter'}</button>
      </div>
      <div id="inspi-video-lecteur-${inspi.id}"></div>
      <div id="inspi-video-miniatures-${inspi.id}" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px"></div>
    </div>

    ${(reponsesBartender && reponsesBartender.length > 0) ? `
    <div class="plante-section">
      <h3>📱 Réponses bartender (${reponsesBartender.length})</h3>
      ${reponsesBartender.map(r => renderReponseBartender(r)).join('')}
    </div>` : ''}

${ings.length > 0 ? (() => {
      const statuts = ings.map(ing => statutIngredientPreview(typeof ing === 'string' ? ing : ing.nom));
      const nbOk = statuts.filter(s => s === 'ok').length;
      return `
    <div class="plante-section">
      <h3>Ingrédients</h3>
      <div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px">📦 ${nbOk}/${ings.length} déjà en cave</div>
      ${ings.map((ing, idx) => {
        const nomIng = typeof ing === 'string' ? ing : ing.nom;
        const uniteValide = (ing.unite && ing.unite !== 'null') ? ing.unite : '';
        const dosage = ing.quantite ? `<span style="color:var(--text-accent);font-weight:600;margin-left:8px">${ing.quantite}${uniteValide ? ' ' + uniteValide : ''}</span>` : '';
        const statut = statuts[idx];
        return `<div style="display:flex;flex-direction:column;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.9rem">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span>${nomIng}</span>
            <div style="display:flex;align-items:center;gap:8px">${dosage}${badgeStatutIngredientInspiration(statut)}</div>
          </div>
          ${statut !== 'ok' ? `<button class="btn-outline" style="align-self:flex-start;margin-top:4px;font-size:0.72rem;padding:3px 10px" onclick="ouvrirLiaisonIngredient('${nomIng.replace(/'/g, "\\'")}', null, () => ouvrirFicheInspiration('${inspi.id}'))">🔗 Préparer dans Ma Cave</button>` : ''}
        </div>`;
      }).join('')}
    </div>`;
    })() : ''}

${(() => {
  if (!inspi.notes) return '';
  let notes = inspi.notes;
  try { notes = JSON.parse(inspi.notes); } catch(e) { return `<div class="plante-section"><h3>Notes</h3><p>${inspi.notes}</p></div>`; }
  if (typeof notes !== 'object') return `<div class="plante-section"><h3>Notes</h3><p>${inspi.notes}</p></div>`;
  const lignes = [];
  if (notes.prenom) lignes.push(`<div style="font-size:0.85rem">👤 Partagé par <strong>${notes.prenom}</strong></div>`);
  if (notes.type) lignes.push(`<div style="font-size:0.85rem">📌 Type : <strong>${notes.type === 'cocktail' ? 'Cocktail' : 'Concoction/Recette'}</strong></div>`);
  if (notes.origine) lignes.push(`<div style="font-size:0.85rem;font-style:italic;color:var(--text-secondary)">💬 "${notes.origine}"</div>`);
if (notes.methode && (Array.isArray(notes.methode) ? notes.methode.length : notes.methode !== 'null')) {
  const etapesHtml = Array.isArray(notes.methode)
    ? notes.methode.map((e, i) => `<div style="margin-top:2px">${i + 1}. ${e}</div>`).join('')
    : `<div>${notes.methode}</div>`;
  lignes.push(`<div style="font-size:0.85rem">🔧 <strong>Préparation :</strong>${notes.methode_source ? ` <span style="font-size:0.72rem;color:var(--text-muted);font-style:italic">(${notes.methode_source})</span>` : ''}${etapesHtml}</div>`);
}
  if (notes.garniture && notes.garniture !== 'null') lignes.push(`<div style="font-size:0.85rem">🍋 <strong>Garniture :</strong> ${notes.garniture}</div>`);
 if (notes.complements && notes.complements !== 'null') lignes.push(`<div style="font-size:0.82rem;color:var(--text-secondary);margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">💡 ${notes.complements}</div>`);
  if (notes.etapes?.length) lignes.push(`<div style="font-size:0.85rem;margin-top:4px"><strong>Étapes :</strong><br>${notes.etapes.map((e,i) => `${i+1}. ${e.description}${e.duree ? ' — ' + e.duree + ' ' + e.unite : ''}`).join('<br>')}</div>`);
  return lignes.length ? `<div class="plante-section" style="display:flex;flex-direction:column;gap:8px;background:var(--bg-accent);border-radius:10px;padding:12px;border:1px solid var(--border-accent)">${lignes.join('')}</div>` : '';
})()}

    ${tags.length > 0 ? `
    <div class="plante-section">
      <h3>Tags</h3>
      <div class="herbo-usages">${tags.map(t => `<span class="herbo-usage-tag">${t}</span>`).join('')}</div>
    </div>` : ''}

   ${inspi.analyse_result ? `
    <div class="plante-section">
      <h3>✨ Analyse Claude</h3>
      <div style="background:var(--bg-accent);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px">
        <div style="font-weight:600">${inspi.analyse_result.type === 'nouvelle' ? '🆕 Nouvelle recette' : `🔄 Variante de ${inspi.analyse_result.recette_similaire}`}</div>
        ${inspi.analyse_result.famille ? `<div style="font-size:0.85rem">Famille : <strong>${inspi.analyse_result.famille}</strong></div>` : ''}
        ${inspi.analyse_result.cocktails_proches?.length ? `<div style="font-size:0.85rem">Proches de : ${inspi.analyse_result.cocktails_proches.join(', ')}</div>` : ''}
        ${inspi.analyse_result.score ? `<div style="font-size:0.78rem;color:var(--text-secondary)">Similarité : ${inspi.analyse_result.score}%</div>` : ''}
        <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.5">${inspi.analyse_result.explication || ''}</div>
      </div>
    </div>` : ''}

<div class="plante-section" style="display:flex;flex-direction:column;gap:10px">
  <button class="btn-primary" onclick="analyserInspiration('${inspi.id}')">
    ✨ Analyser avec Claude
  </button>
  ${inspi.statut === 'en_attente' ? `
  ${ings.length > 0 ? `
  <button class="btn-outline" style="border-color:var(--border-success);color:var(--text-success)" onclick="validerDirectement('${inspi.id}')">
    ✅ Créer la recette avec ces ingrédients
  </button>` : ''}
  <button class="btn-outline" onclick="ouvrirCompleterDepuisFiche('${inspi.id}')">✨ Compléter et valider</button>
${inspi.source !== 'url' ? `<button class="btn-outline" onclick="ouvrirQRDepuisFiche('${inspi.id}')">📱 Dévoile ton cocktail</button>` : ''}
  <button class="btn-outline" onclick="rejeterInspiration('${inspi.id}')">❌ Rejeter</button>` : ''}
  ${inspi.statut === 'validee' ? `<div style="color:var(--text-success);font-size:0.85rem;text-align:center">✅ Déjà validée</div>` : ''}
  <button class="btn-outline" style="color:var(--text-danger);border-color:var(--border-danger);margin-top:8px" onclick="supprimerInspiration('${inspi.id}')">🗑 Supprimer cette inspiration</button>
</div>
`;
afficherModal('modal-fiche-inspiration');

  if (inspi.video_url) {
    setTimeout(() => {
      lancerLectureVideoInspiration(inspi.id, inspi.video_url);
      afficherChoixMiniaturesInspiration(inspi.id, inspi.video_url);
    }, 50);
  }
}
async function associerVideoInspiration(id) {
  const input = document.getElementById(`inspi-video-input-${id}`);
  if (!input) return;
  const url = input.value.trim();
  if (!url) return;

  const { error } = await db.from('inspirations').update({ video_url: url }).eq('id', id).eq('user_id', currentUser.id);
  if (error) { alert('Erreur : ' + error.message); return; }

  const inspi = inspirationsList.find(x => x.id === id);
  if (inspi) inspi.video_url = url;

  lancerLectureVideoInspiration(id, url);
  afficherChoixMiniaturesInspiration(id, url);
}

function lancerLectureVideoInspiration(id, videoUrl) {
  const zone = document.getElementById(`inspi-video-lecteur-${id}`);
  if (!zone) return;
  const ytId = extraireYoutubeId(videoUrl);
  if (ytId) {
    zone.innerHTML = `
      <div style="position:relative;width:100%;max-width:280px;aspect-ratio:9/16;margin:8px auto;border-radius:10px;overflow:hidden">
        <iframe src="https://www.youtube.com/embed/${ytId}?playsinline=1"
          style="width:100%;height:100%;border:none" allow="autoplay; encrypted-media" allowfullscreen></iframe>
      </div>
    `;
  } else {
    zone.innerHTML = `<a href="${videoUrl}" target="_blank" class="btn-outline" style="display:inline-block;margin-top:8px">▶️ Ouvrir la vidéo</a>`;
  }
}

function afficherChoixMiniaturesInspiration(id, videoUrl) {
  const zone = document.getElementById(`inspi-video-miniatures-${id}`);
  if (!zone) return;
  const ytId = extraireYoutubeId(videoUrl);
  if (!ytId) { zone.innerHTML = ''; return; }

  const options = [0, 1, 2, 3].map(n => `https://img.youtube.com/vi/${ytId}/${n}.jpg`);
  zone.innerHTML = options.map(url => `
    <img src="${url}" onclick="definirMiniatureVideoInspiration('${id}', '${url}')"
      style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid var(--border)"
      onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
  `).join('');
}

async function definirMiniatureVideoInspiration(id, url) {
  await db.from('inspirations').update({ video_thumbnail_url: url }).eq('id', id).eq('user_id', currentUser.id);
  const inspi = inspirationsList.find(x => x.id === id);
  if (inspi) inspi.video_thumbnail_url = url;
  alert('Miniature vidéo enregistrée.');
}
async function associerVideoInspiration(id) {
  const input = document.getElementById(`inspi-video-input-${id}`);
  if (!input) return;
  const url = input.value.trim();
  if (!url) return;

  const { error } = await db.from('inspirations').update({ video_url: url }).eq('id', id).eq('user_id', currentUser.id);
  if (error) { alert('Erreur : ' + error.message); return; }

  const inspi = inspirationsList.find(x => x.id === id);
  if (inspi) inspi.video_url = url;

  lancerLectureVideoInspiration(id, url);
  afficherChoixMiniaturesInspiration(id, url);
}

function lancerLectureVideoInspiration(id, videoUrl) {
  const zone = document.getElementById(`inspi-video-lecteur-${id}`);
  if (!zone) return;
  const ytId = extraireYoutubeId(videoUrl);
  if (ytId) {
    zone.innerHTML = `
      <div style="position:relative;width:100%;max-width:280px;aspect-ratio:9/16;margin:8px auto;border-radius:10px;overflow:hidden">
        <iframe src="https://www.youtube.com/embed/${ytId}?playsinline=1"
          style="width:100%;height:100%;border:none" allow="autoplay; encrypted-media" allowfullscreen></iframe>
      </div>
    `;
  } else {
    zone.innerHTML = `<a href="${videoUrl}" target="_blank" class="btn-outline" style="display:inline-block;margin-top:8px">▶️ Ouvrir la vidéo</a>`;
  }
}

function afficherChoixMiniaturesInspiration(id, videoUrl) {
  const zone = document.getElementById(`inspi-video-miniatures-${id}`);
  if (!zone) return;
  const ytId = extraireYoutubeId(videoUrl);
  if (!ytId) { zone.innerHTML = ''; return; }

  const options = [0, 1, 2, 3].map(n => `https://img.youtube.com/vi/${ytId}/${n}.jpg`);
  zone.innerHTML = options.map(url => `
    <img src="${url}" onclick="definirMiniatureVideoInspiration('${id}', '${url}')"
      style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid var(--border)"
      onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
  `).join('');
}

async function definirMiniatureVideoInspiration(id, url) {
  await db.from('inspirations').update({ video_thumbnail_url: url }).eq('id', id).eq('user_id', currentUser.id);
  const inspi = inspirationsList.find(x => x.id === id);
  if (inspi) inspi.video_thumbnail_url = url;
  alert('Miniature vidéo enregistrée.');
}
function renderReponseBartender(r) {
  const dateStr = new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const statutBadge = r.statut === 'validee'
    ? `<span style="font-size:0.75rem;padding:3px 8px;border-radius:20px;background:var(--bg-success);color:var(--text-success)">✅ Validée</span>`
    : `<span style="font-size:0.75rem;padding:3px 8px;border-radius:20px;background:var(--bg-danger);color:var(--text-danger)">❌ Invalidée</span>`;

  const MOTIF_LABELS = {
    trop_sucre_amer: 'Trop sucré/amer',
    mauvaise_base: 'Mauvaise base alcool',
    dosages_a_revoir: 'Dosages à revoir',
    mauvaise_piste: 'Mauvaise piste'
  };

  let detailHtml = '';
  if (r.mode === 'precis') {
    const dosages = Array.isArray(r.dosages_precis) ? r.dosages_precis : [];
    detailHtml = dosages.map(d => `
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.85rem">
        <span>${d.nom}</span><span style="color:var(--text-secondary)">${d.quantite} ${d.unite}</span>
      </div>`).join('');
  } else {
    const INTENSITE_LABEL = ['Léger', 'Moyen', 'Fort'];
    const SUCRE_LABEL = ['Peu', 'Moyen', 'Beaucoup'];
    const ACIDE_LABEL = ['Peu', 'Moyen', 'Beaucoup'];
    const AMER_LABEL = ['Absent', 'Léger', 'Présent'];
    const PETILLANT_LABEL = ['Non', 'Léger', 'Oui'];
    const VOLUME_LABEL = ['~10cl', '~15cl', '~20cl'];
    detailHtml = `
      <div style="font-size:0.82rem;color:var(--text-secondary);display:grid;grid-template-columns:1fr 1fr;gap:4px">
        <div>Alcool : ${INTENSITE_LABEL[r.intensite_alcool] ?? '—'}</div>
        <div>Sucré : ${SUCRE_LABEL[r.sucre] ?? '—'}</div>
        <div>Acide : ${ACIDE_LABEL[r.acide] ?? '—'}</div>
        <div>Amer : ${AMER_LABEL[r.amer] ?? '—'}</div>
        <div>Pétillant : ${PETILLANT_LABEL[r.petillant] ?? '—'}</div>
        <div>Volume : ${VOLUME_LABEL[r.volume] ?? '—'}</div>
      </div>`;
  }

  const boutonReprendre = r.mode === 'precis'
    ? `<button class="btn-outline" style="margin-top:8px;padding:8px 10px;font-size:0.78rem" onclick="reprendreDosagesPrecis('${r.id}','${r.inspiration_id}')">↩️ Reprendre ces dosages dans "Compléter"</button>`
    : `<button class="btn-outline" style="margin-top:8px;padding:8px 10px;font-size:0.78rem" onclick="reprendreImpressionsSecret('${r.id}','${r.inspiration_id}')">↩️ Reprendre ces impressions dans "Compléter"</button>`;

  return `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:0.8rem;color:var(--text-secondary)">${r.mode === 'precis' ? '🔓 Dosages précis' : '🔒 Impressions'} · ${dateStr}</span>
        ${statutBadge}
      </div>
      ${(r.famille_percue || r.verre_percu) ? `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        ${r.famille_percue ? `<span class="herbo-usage-tag">📂 ${r.famille_percue}</span>` : ''}
        ${r.verre_percu ? `<span class="herbo-usage-tag">🥃 ${r.verre_percu}</span>` : ''}
      </div>` : ''}
      ${r.ingredients_bartender ? `<div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px">${r.ingredients_bartender}</div>` : ''}
      ${detailHtml}
      ${r.motif_invalidation ? `<div style="font-size:0.78rem;color:var(--text-danger);margin-top:8px">Motif : ${MOTIF_LABELS[r.motif_invalidation] || r.motif_invalidation}</div>` : ''}
      ${boutonReprendre}
    </div>
  `;
}

async function reprendreDosagesPrecis(reponseId, inspirationId) {
  const { data: reponse } = await db.from('bartender_reponses').select('*').eq('id', reponseId).single();
  if (!reponse) return;
  const dosages = Array.isArray(reponse.dosages_precis) ? reponse.dosages_precis : [];
  const ingredientsFormates = dosages.map(d => `${d.nom} (${d.quantite} ${d.unite})`);

  await db.from('inspirations').update({ ingredients: ingredientsFormates }).eq('id', inspirationId);
  const idx = inspirationsList.findIndex(x => x.id === inspirationId);
  if (idx !== -1) inspirationsList[idx].ingredients = ingredientsFormates;

  fermerModal('modal-fiche-inspiration');
  ouvrirModalCompleter(inspirationId);
}

async function reprendreImpressionsSecret(reponseId, inspirationId) {
  const { data: reponse } = await db.from('bartender_reponses').select('*').eq('id', reponseId).single();
  if (!reponse) return;

  fermerModal('modal-fiche-inspiration');
  ouvrirModalCompleter(inspirationId);

  setTimeout(() => {
    completerInspirationData.sliders = {
      intensite_alcool: reponse.intensite_alcool ?? 1,
      sucre: reponse.sucre ?? 1,
      acide: reponse.acide ?? 1,
      amer: reponse.amer ?? 1,
      petillant: reponse.petillant ?? 0,
      volume: reponse.volume ?? 1
    };
    toggleGoutSliders();
    document.querySelectorAll('#sliders-gout [data-key]').forEach(btn => {
      const key = btn.dataset.key;
      const val = parseInt(btn.dataset.val);
      btn.classList.toggle('active', val === completerInspirationData.sliders[key]);
    });
  }, 50);
}
function ouvrirQRBartender(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;
  const qrUrl = `https://bar-cocktail-smoky.vercel.app/bartender.html?inspiration=${id}`;
  document.getElementById('qr-bartender-contenu').innerHTML = `
    <div style="text-align:center">
      <div style="font-size:1.2rem;font-weight:700;margin-bottom:6px">📱 Dévoile ton cocktail</div>
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:4px;line-height:1.4">Dosages précis ou secret bien gardé — à toi de voir.</div>
      <div style="font-size:0.78rem;color:var(--text-accent);margin-bottom:16px">${inspi.nom}</div>
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}" width="180" height="180" style="border-radius:8px" />
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;word-break:break-all">${qrUrl}</div>
      </div>
      <button class="btn-outline" style="margin-top:12px" onclick="copierLienBartender('${qrUrl}')">🔗 Copier le lien</button>
      <div id="qr-bartender-copie-msg" style="font-size:0.78rem;color:var(--text-success);margin-top:6px;min-height:18px"></div>
    </div>
  `;
  afficherModal('modal-qr-bartender');
}

function copierLienBartender(url) {
  navigator.clipboard.writeText(url).then(() => {
    const el = document.getElementById('qr-bartender-copie-msg');
    if (el) {
      el.textContent = '✅ Lien copié !';
      setTimeout(() => { el.textContent = ''; }, 2000);
    }
  });
}
async function analyserInspiration(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;

  const btn = document.querySelector('#modal-fiche-inspiration .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyse en cours…'; }

  const ings = Array.isArray(inspi.ingredients) ? inspi.ingredients.map(i => typeof i === 'string' ? i : i.nom).join(', ') : '';
  const recettesNoms = recettes.slice(0, 80).map(r => `${r.nom} (${(r.recette_ingredients || []).map(i => i.nom).join(', ')})`).join('\n');

  try {
    const response = await fetch('/api/analyser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
prompt: `Tu es un expert bartending. Analyse cette inspiration de cocktail.

Inspiration : "${inspi.nom}"
Ingrédients : ${ings || 'non précisés'}

Recettes existantes dans la cave :
${recettesNoms}

Réponds en JSON uniquement :
{
  "type": "nouvelle" ou "variante",
  "recette_similaire": "nom de la recette la plus proche si variante, null si vraiment nouvelle",
  "score": pourcentage de similarité (0-100),
  "famille": "famille bartending (Sour, Spritz, Fizz, Tiki, Spirit forward...)",
  "cocktails_proches": ["nom1", "nom2"],
  "explication": "analyse courte en français : famille, profil gustatif estimé, similitudes et différences avec les recettes existantes"
}`
      })
    });

    const result = await response.json();
    let analyse;
    try { analyse = typeof result === 'string' ? JSON.parse(result) : result; }
    catch(e) { analyse = { type: 'nouvelle', explication: 'Analyse non concluante', score: 0 }; }

    await db.from('inspirations').update({ analyse_result: analyse }).eq('id', id);
    const idx = inspirationsList.findIndex(x => x.id === id);
    if (idx !== -1) inspirationsList[idx].analyse_result = analyse;

    ouvrirFicheInspiration(id);
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = '✨ Analyser avec Claude'; }
  }
}


async function rejeterInspiration(id) {
  await db.from('inspirations').update({ statut: 'rejetee' }).eq('id', id);
  const idx = inspirationsList.findIndex(x => x.id === id);
  if (idx !== -1) inspirationsList[idx].statut = 'rejetee';
  fermerModal('modal-fiche-inspiration');
  renderInspirations();
}
let completerInspirationData = null;
function ouvrirCompleterDepuisFiche(id) {
  document.getElementById('modal-fiche-inspiration').classList.remove('visible');
  ouvrirModalCompleter(id);
}
async function supprimerInspiration(id) {
  if (!confirm('Supprimer définitivement cette inspiration ? Cette action est irréversible.')) return;
  const { error } = await db.from('inspirations').delete().eq('id', id).eq('user_id', currentUser.id);
  if (error) { alert('Erreur : ' + error.message); return; }
  inspirationsList = inspirationsList.filter(x => x.id !== id);
  fermerModal('modal-fiche-inspiration');
  renderInspirations();
}
// Tente de relier un nom d'ingrédient à un item réel de Ma Cave —
// 1) match direct si la marque est citée dans l'ingrédient
// 2) sinon, category_id réel de la bouteille (fiable — pas de devinette sur son nom)
// Les ingrédients frais/périssables ne sont jamais catalogués dans Ma Cave, on ne tente pas.
// Matching sûr uniquement — jamais de déduction par catégorie/mots-clés.
// Ne relie que ce qui est déjà confirmé : alias exact validé via 🔗,
// ou entrée du glossaire déjà rattachée à une bouteille de Ma Cave.
// Matching sûr uniquement — jamais de déduction par catégorie/mots-clés fourre-tout.
function trouverItemCaveCorrespondant(nomIngredient) {
  const nom = (nomIngredient || '').toLowerCase().trim();
  if (!nom) return null;

  // 1. Alias déjà confirmé par l'utilisateur (nom exact)
  if (ingredientsAlias[nom]) return ingredientsAlias[nom];

  // 2. Entrée glossaire déjà liée à une bouteille (nom canonique ou alias exact)
  const matchGlossaire = glossaireIngredients.find(g =>
    g.item_cave_id && (
      g.nom_canonique.toLowerCase() === nom ||
      (g.alias || []).some(a => a.toLowerCase() === nom)
    )
  );
  if (matchGlossaire) return matchGlossaire.item_cave_id;

  // 3. Catégories de base non-ambiguës uniquement — jamais de paniers fourre-tout
  const baseSansAmbiguite = { 'gin': 'gin', 'vodka': 'vodka', 'rhum': 'rhum', 'whisky': 'whisky' };
  const catId = baseSansAmbiguite[nom];
  if (catId) {
    const cat = (cave?.categories || []).find(c => c.id === catId);
    const possedes = (cat?.items || []).filter(i => i.detenu !== false);
    if (possedes.length === 1) return possedes[0].id;
  }

  // 4. Tequila / Mezcal : catégorie cave partagée — vérification du nom en plus du nombre
  if (nom === 'tequila' || nom === 'mezcal') {
    const cat = (cave?.categories || []).find(c => c.id === 'mezcal-tequila');
    const possedes = (cat?.items || []).filter(i => i.detenu !== false);
    const correspondants = possedes.filter(i => (i.nom || '').toLowerCase().includes(nom));
    if (correspondants.length === 1) return correspondants[0].id;
  }

  return null;
}
async function validerDirectement(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;
  const ings = Array.isArray(inspi.ingredients) ? inspi.ingredients : [];
  
  let notesTournee = {};
  try { notesTournee = JSON.parse(inspi.notes || '{}'); } catch(e) {}

  const recetteId = 'inspi-' + Date.now();
  const anecdote = [
    notesTournee.origine || null,
    notesTournee.prenom ? `Partagé par ${notesTournee.prenom} via La Tournée.` : null,
    inspi.source === 'url' ? `Source : ${inspi.source_detail}` : null
  ].filter(Boolean).join(' — ') || null;

  const complementsTexte = (notesTournee.complements && notesTournee.complements !== 'null') ? notesTournee.complements : null;

  const { data: recette, error } = await db.from('recettes').insert({
    id: recetteId,
    user_id: currentUser.id,
    type: 'cocktail',
    nom: inspi.nom,
    difficulte: 'moyen',
   base_alcool: (notesTournee.base_alcool && notesTournee.base_alcool !== 'null') ? notesTournee.base_alcool : null,
photo_url: inspi.photo_url || null,
    photo_cadrage: inspi.photo_cadrage || null,
    anecdote,
    variante_notes: complementsTexte,
    source_marque: inspi.source === 'url' ? inspi.source_detail : null
  }).select().single();

  if (error) { alert('Erreur : ' + error.message); return; }

if (recette && ings.length > 0) {
    await db.from('recette_ingredients').insert(
      ings.map((ing, i) => {
        const nomIng = typeof ing === 'string' ? ing : ing.nom;
        return {
          recette_id: recetteId,
          user_id: currentUser.id,
          nom: nomIng,
          quantite: ing.quantite || null,
          unite: ing.unite || 'cl',
          item_cave_id: trouverItemCaveCorrespondant(nomIng),
          ordre: i + 1
        };
      })
    );
  }

  const etapesMethode = Array.isArray(notesTournee.methode) ? notesTournee.methode : (notesTournee.methode && notesTournee.methode !== 'null' ? [notesTournee.methode] : []);
  if (recette && etapesMethode.length > 0) {
    await db.from('recette_etapes').insert(
      etapesMethode.map((texte, i) => ({
        recette_id: recetteId,
        user_id: currentUser.id,
        ordre: i + 1,
        titre: `Étape ${i + 1}`,
        description: texte
      }))
    );
  }

  await db.from('inspirations').update({
    statut: 'validee',
    recette_liee_id: recetteId
  }).eq('id', id);

  const idx = inspirationsList.findIndex(x => x.id === id);
  if (idx !== -1) {
    inspirationsList[idx].statut = 'validee';
    inspirationsList[idx].recette_liee_id = recetteId;
  }

  fermerModal('modal-fiche-inspiration');
  renderInspirations();
  await chargerRecettes();
  alert(`✅ "${inspi.nom}" créée dans vos recettes !`);
}
function ouvrirQRDepuisFiche(id) {
  document.getElementById('modal-fiche-inspiration').classList.remove('visible');
  ouvrirQRBartender(id);
}
async function ouvrirModalCompleter(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;
completerInspirationData = { inspi, dosages: {}, profil: {}, gouteTaste: false, sliders: { intensite_alcool: 1, sucre: 1, acide: 1, amer: 1, petillant: 0, volume: 1 } };
  document.getElementById('completer-inspiration-contenu').innerHTML = `
    <h2 style="margin-bottom:4px">${inspi.nom}</h2>
    <div class="herbo-latin" style="margin-bottom:16px">${inspi.source_detail || ''}</div>

    <div class="plante-section">
      <h3>Ingrédients détectés</h3>
      ${(Array.isArray(inspi.ingredients) ? inspi.ingredients : []).map(ing => `
        <div style="font-size:0.85rem;padding:4px 0;border-bottom:1px solid var(--border)">${typeof ing === 'string' ? ing : ing.nom}</div>
      `).join('')}
    </div>

    <div class="plante-section">
      <h3>🍸 J'ai goûté ce cocktail</h3>
<div style="display:none;flex-direction:column;gap:12px" id="sliders-gout">
${[
          { key: 'intensite_alcool', label: 'Intensité alcool', options: ['Léger', 'Moyen', 'Fort'] },
          { key: 'sucre', label: 'Sucré', options: ['Peu', 'Moyen', 'Beaucoup'] },
          { key: 'acide', label: 'Acide / Frais', options: ['Peu', 'Moyen', 'Beaucoup'] },
          { key: 'amer', label: 'Amer', options: ['Absent', 'Léger', 'Présent'] },
          { key: 'petillant', label: 'Pétillant', options: ['Non', 'Léger', 'Oui'] },
          { key: 'volume', label: 'Volume estimé', options: ['~10cl', '~15cl', '~20cl'] }
        ].map(s => `
          <div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px">${s.label}</div>
            <div style="display:flex;gap:6px">
              ${s.options.map((opt, i) => `
<button class="config-btn ${i === completerInspirationData.sliders[s.key] ? 'active' : ''}"
data-key="${s.key}" data-val="${i}"
                  onclick="selectGoutSlider(this, '${s.key}', ${i})">
                  ${opt}
                </button>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <button class="btn-outline" style="width:100%;margin-top:8px" id="btn-gout-toggle" onclick="toggleGoutSliders()">
        🍷 J'ai goûté — ajouter mes impressions
      </button>
    </div>

    <div class="plante-section">
      <button class="btn-primary" style="width:100%" onclick="analyserEtCompleter('${inspi.id}')">
        ✨ Analyser et proposer la recette
      </button>
    </div>

    <div id="completer-resultat" style="display:none">
    </div>
  `;

  afficherModal('modal-completer-inspiration');
}

function toggleGoutSliders() {
  const sliders = document.getElementById('sliders-gout');
  const btn = document.getElementById('btn-gout-toggle');
  const visible = sliders.style.display !== 'none';
  sliders.style.display = visible ? 'none' : 'flex';
  sliders.style.flexDirection = 'column';
  sliders.style.gap = '12px';
  btn.textContent = visible ? '🍷 J\'ai goûté — ajouter mes impressions' : '✕ Masquer les impressions';
  completerInspirationData.gouteTaste = !visible;
}

function selectGoutSlider(btn, key, val) {
  document.querySelectorAll(`[data-key="${key}"]`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  completerInspirationData.sliders[key] = val;
}

async function analyserEtCompleter(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;

  const btn = document.querySelector('#modal-completer-inspiration .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyse en cours…'; }

  const ings = Array.isArray(inspi.ingredients) ? inspi.ingredients.map(i => typeof i === 'string' ? i : i.nom) : [];
  const s = completerInspirationData.sliders;
  const intensiteLabel = ['léger', 'moyen', 'fort'];
  const sucreLabel = ['peu sucré', 'moyennement sucré', 'très sucré'];
  const acideLabel = ['peu acide', 'moyennement acide', 'très acide/frais'];
  const amerLabel = ['sans amertume', 'légèrement amer', 'amer'];
  const petillantLabel = ['non pétillant', 'légèrement pétillant', 'très pétillant'];
  const volumeLabel = ['~10cl', '~15cl', '~20cl'];

  const goutContext = completerInspirationData.gouteTaste ? `
Impressions gustatives du dégustateur :
- Intensité alcool : ${intensiteLabel[s.intensite_alcool]}
- Sucré : ${sucreLabel[s.sucre]}
- Acide/Frais : ${acideLabel[s.acide]}
- Amer : ${amerLabel[s.amer]}
- Pétillant : ${petillantLabel[s.petillant]}
- Volume estimé : ${volumeLabel[s.volume]}` : '';

  try {
const response = await fetch('/api/inspiration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: inspi.nom,
        ingredients: ings.join(', '),
        gout_context: completerInspirationData.gouteTaste ? goutContext : '',
        recettes_existantes: recettes.slice(0, 50).map(r => r.nom).join(', ')
      })
    });

const result = await response.json();

    completerInspirationData.dosages = result.dosages || [];
    completerInspirationData.profil = result.profil || {};
    completerInspirationData.result = result;

    // Afficher le résultat
    const profilLabels = { gout_sucre: 'Sucré', gout_amer: 'Amer', gout_acide: 'Acide', gout_fruite: 'Fruité', gout_fume: 'Fumé', gout_floral: 'Floral', gout_epice: 'Épicé', gout_cremeux: 'Crémeux' };

    document.getElementById('completer-resultat').style.display = 'block';
    document.getElementById('completer-resultat').innerHTML = `
      <div class="plante-section">
        <h3>✨ Proposition Claude</h3>
        <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px">${result.explication || ''}</div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          ${result.famille ? `<span class="herbo-usage-tag">📂 ${result.famille}</span>` : ''}
          ${result.base_alcool ? `<span class="herbo-usage-tag">🍶 ${result.base_alcool}</span>` : ''}
          ${result.verre ? `<span class="herbo-usage-tag">🥃 ${result.verre}</span>` : ''}
          ${result.type === 'variante' && result.recette_similaire ? `<span class="herbo-usage-tag" style="background:var(--bg-warning);color:var(--text-warning)">🔄 Proche de ${result.recette_similaire}</span>` : ''}
        </div>

        <h4 style="font-size:0.85rem;margin-bottom:8px">Dosages proposés</h4>
        ${(result.dosages || []).map(d => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:0.85rem">${d.nom}</span>
            <input type="number" value="${d.quantite}" min="0" max="200" step="5"
              style="width:70px;text-align:right;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text-primary)"
              onchange="completerInspirationData.dosages.find(x=>x.nom==='${d.nom}').quantite=parseInt(this.value)">
            <span style="font-size:0.82rem;color:var(--text-secondary);width:30px">${d.unite}</span>
          </div>`).join('')}

        <h4 style="font-size:0.85rem;margin:12px 0 8px">Profil gustatif estimé</h4>
        ${Object.entries(result.profil || {}).filter(([k,v]) => v > 0).map(([k,v]) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:0.78rem;width:60px;color:var(--text-secondary)">${profilLabels[k] || k}</span>
            <div style="flex:1;height:6px;background:var(--border);border-radius:3px">
              <div style="width:${v*20}%;height:100%;background:var(--accent);border-radius:3px"></div>
            </div>
            <span style="font-size:0.78rem;color:var(--text-secondary)">${v}/5</span>
          </div>`).join('')}

        <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
          <button class="btn-primary" onclick="validerAvecDosages('${id}')">
            ✅ Valider et créer la recette
          </button>
          ${result.type === 'variante' && result.recette_similaire ? `
          <button class="btn-outline" onclick="lierRecetteExistante('${id}', '${result.recette_similaire}')">
            🔄 Lier à "${result.recette_similaire}" comme variante
          </button>` : ''}
        </div>
      </div>
    `;

    if (btn) { btn.disabled = false; btn.textContent = '✨ Analyser et proposer la recette'; }

} catch(e) {
    console.error('ERREUR analyserEtCompleter:', e);
    alert('Erreur : ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '✨ Analyser et proposer la recette'; }
  }
}

async function validerAvecDosages(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;
  const result = completerInspirationData.result;
  const dosages = completerInspirationData.dosages;

 const recetteId = 'inspi-' + Date.now();

  // Parser les notes La Tournée
  let notesTournee = {};
  try { notesTournee = JSON.parse(inspi.notes || '{}'); } catch(e) {}

  const anecdoteFinale = [
    notesTournee.origine || null,
    notesTournee.prenom ? `Partagé par ${notesTournee.prenom} via La Tournée.` : null
  ].filter(Boolean).join(' — ') || null;

  const { data: recette } = await db.from('recettes').insert({
    id: recetteId,
    user_id: currentUser.id,
    type: 'cocktail',
    nom: inspi.nom,
    difficulte: result.difficulte || 'moyen',
    base_alcool: result.base_alcool || null,
    verre_type: result.verre || null,
    description_courte: result.explication || null,
anecdote: anecdoteFinale,
    photo_url: inspi.photo_url || null,
    photo_cadrage: inspi.photo_cadrage || null,
    ...completerInspirationData.profil
  }).select().single();

  if (recette && dosages.length > 0) {
    await db.from('recette_ingredients').insert(
      dosages.map((d, i) => ({
        recette_id: recetteId,
        user_id: currentUser.id,
        nom: d.nom,
        quantite: d.quantite,
        unite: d.unite,
        ordre: i + 1
      }))
    );
  }

  await db.from('inspirations').update({
    statut: 'validee',
    recette_liee_id: recetteId,
    analyse_result: result
  }).eq('id', id);

  const idx = inspirationsList.findIndex(x => x.id === id);
  if (idx !== -1) {
    inspirationsList[idx].statut = 'validee';
    inspirationsList[idx].recette_liee_id = recetteId;
  }

  fermerModal('modal-completer-inspiration');
  fermerModal('modal-fiche-inspiration');
  renderInspirations();
  await chargerRecettes();
  alert(`✅ "${inspi.nom}" créée avec dosages dans vos recettes !`);
}

async function lierRecetteExistante(id, nomRecette) {
  const recette = recettes.find(r => r.nom.toLowerCase() === nomRecette.toLowerCase());
  await db.from('inspirations').update({
    statut: 'validee',
    recette_liee_id: recette?.id || null,
    analyse_result: completerInspirationData.result
  }).eq('id', id);

  const idx = inspirationsList.findIndex(x => x.id === id);
  if (idx !== -1) inspirationsList[idx].statut = 'validee';

  fermerModal('modal-completer-inspiration');
  fermerModal('modal-fiche-inspiration');
  renderInspirations();
  alert(`🔄 Inspiration liée à "${nomRecette}".`);
}
let grimoireList = [];
let filtreGrimoireAlcool = null;
let filtreGrimoireCategorie = '';

async function chargerGrimoire() {
  const container = document.getElementById('grimoire-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Chargement…</div>';
  const { data } = await db.from('grimoire').select('*').order('nom');
  if (!data) return;
  grimoireList = data;
  renderGrimoire(data);
}

function renderGrimoire(recettes) {
  const container = document.getElementById('grimoire-container');
  if (!container) return;

  const categories = [...new Set(recettes.map(r => r.categorie).filter(Boolean))].sort();
  let liste = recettes;
  if (filtreGrimoireAlcool !== null) liste = liste.filter(r => r.avec_alcool === filtreGrimoireAlcool);
  if (filtreGrimoireCategorie) liste = liste.filter(r => r.categorie === filtreGrimoireCategorie);

  const catLabels = {
    'maceration': 'Macération', 'infusion': 'Infusion', 'liqueur': 'Liqueur',
    'creme-de': 'Crème de...', 'sirop': 'Sirop', 'cordial': 'Cordial',
    'shrub': 'Shrub', 'teinture': 'Teinture', 'oleosaccharum': 'Oléosaccharum',
    'kefir-de-fruits': 'Kéfir de fruits', 'bitter-maison': 'Bitter maison'
  };

  container.innerHTML = `
    <div class="herbo-filtres">
      <button class="herbo-filtre-btn ${filtreGrimoireAlcool === null && !filtreGrimoireCategorie ? 'active' : ''}"
        onclick="filtreGrimoireAlcool=null; filtreGrimoireCategorie=''; renderGrimoire(grimoireList)">Tout</button>
      <button class="herbo-filtre-btn ${filtreGrimoireAlcool === true ? 'active' : ''}"
        onclick="filtreGrimoireAlcool=true; filtreGrimoireCategorie=''; renderGrimoire(grimoireList)">🍶 Avec alcool</button>
      <button class="herbo-filtre-btn ${filtreGrimoireAlcool === false ? 'active' : ''}"
        onclick="filtreGrimoireAlcool=false; filtreGrimoireCategorie=''; renderGrimoire(grimoireList)">🌿 Sans alcool</button>
      <span class="herbo-filtre-sep">|</span>
      ${categories.map(c => `
        <button class="herbo-filtre-btn ${filtreGrimoireCategorie === c ? 'active' : ''}"
          onclick="filtreGrimoireCategorie='${c}'; filtreGrimoireAlcool=null; renderGrimoire(grimoireList)">
          ${catLabels[c] || c}
        </button>`).join('')}
    </div>
    <div class="herbo-grille">
      ${liste.length === 0 ? '<div class="empty-state">Aucune recette trouvée.</div>' : ''}
      ${liste.map(r => `
        <div class="herbo-carte" onclick="ouvrirFicheGrimoire('${r.id}')">
          <div class="herbo-carte-top">
            <span class="herbo-emoji">${r.avec_alcool ? '🍶' : '🌿'}</span>
            <div class="herbo-carte-info">
              <div class="herbo-nom">${r.nom}</div>
              <div class="herbo-latin">${catLabels[r.categorie] || r.categorie}</div>
            </div>
            <span class="herbo-saison ${r.avec_alcool ? 'herbo-saison--ok' : 'herbo-saison--off'}">
              ${r.avec_alcool ? '🍸 Alcool' : '🥤 Sans'}
            </span>
          </div>
          <div class="herbo-profil">${r.description ? r.description.substring(0, 80) + '…' : ''}</div>
          <div class="herbo-usages">
            ${r.duree_jours ? `<span class="herbo-usage-tag">⏱ ${r.duree_jours}j</span>` : ''}
            ${r.rendement_cl ? `<span class="herbo-usage-tag">🧪 ${r.rendement_cl}cl</span>` : ''}
            ${r.cout_estime ? `<span class="herbo-usage-tag">💶 ~${r.cout_estime}€</span>` : ''}
            ${r.saison_ideale ? `<span class="herbo-usage-tag">📅 ${r.saison_ideale.substring(0, 20)}</span>` : ''}
          </div>
          ${r.avertissement ? `<div class="plante-fuir" style="margin-top:8px;font-size:0.75rem">${r.avertissement.substring(0, 60)}…</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

async function ouvrirFicheGrimoire(id) {
  const r = grimoireList.find(x => x.id === id);
  if (!r) return;

  // Charger les ingrédients avec prix
  const { data: ingredients } = await db
    .from('grimoire_ingredients')
    .select('*, ingredients_prix(prix_unitaire, unite)')
    .eq('grimoire_id', id)
    .order('ordre');

  const catLabels = {
    'maceration': 'Macération', 'infusion': 'Infusion', 'liqueur': 'Liqueur',
    'creme-de': 'Crème de...', 'sirop': 'Sirop', 'cordial': 'Cordial',
    'shrub': 'Shrub', 'teinture': 'Teinture', 'oleosaccharum': 'Oléosaccharum',
    'kefir-de-fruits': 'Kéfir de fruits', 'bitter-maison': 'Bitter maison'
  };

document.querySelector('.grimoire-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2.5rem">${r.avec_alcool ? '🍶' : '🌿'}</span>
      <div>
        <h2 class="fiche-titre">${r.nom}</h2>
        <div class="herbo-latin">${catLabels[r.categorie] || r.categorie} · ${r.avec_alcool ? 'Avec alcool' : 'Sans alcool'}</div>
      </div>
    </div>

    ${r.avertissement ? `
    <div class="avertissement-danger" style="margin-bottom:16px">
      ${r.avertissement}
    </div>` : ''}

    <div class="plante-section">
      <h3>Description</h3>
      <p>${r.description || '—'}</p>
    </div>

    <div class="plante-section">
      <h3>Informations pratiques</h3>
      <div class="plante-entretien-grid">
        ${r.duree_jours ? `<div class="plante-entretien-item"><span class="plante-entretien-icon">⏱</span><div><div class="plante-entretien-label">Durée</div><div class="plante-entretien-val">${r.duree_jours} jours</div></div></div>` : ''}
        ${r.rendement_cl ? `<div class="plante-entretien-item"><span class="plante-entretien-icon">🧪</span><div><div class="plante-entretien-label">Rendement</div><div class="plante-entretien-val">${r.rendement_cl}cl</div></div></div>` : ''}
        ${r.cout_estime ? `<div class="plante-entretien-item"><span class="plante-entretien-icon">💶</span><div><div class="plante-entretien-label">Coût estimé</div><div class="plante-entretien-val">~${r.cout_estime}€</div></div></div>` : ''}
        ${r.base_volume_cl ? `<div class="plante-entretien-item"><span class="plante-entretien-icon">🍾</span><div><div class="plante-entretien-label">Volume base</div><div class="plante-entretien-val">${r.base_volume_cl}cl</div></div></div>` : ''}
      </div>
    </div>

    ${r.ratio_sucre ? `
    <div class="plante-section">
      <h3>Ratio sucre</h3>
      <p>${r.ratio_sucre}</p>
    </div>` : ''}

    ${r.saison_ideale ? `
    <div class="plante-section">
      <h3>📅 Saison idéale</h3>
      <p>${r.saison_ideale}</p>
    </div>` : ''}

    ${r.conservation_duree ? `
    <div class="plante-section">
      <h3>Conservation</h3>
      <p><strong>${r.conservation_duree}</strong> — ${r.conservation_type || ''}</p>
    </div>` : ''}

    ${r.notes_bartender ? `
    <div class="plante-section">
      <h3>🍸 Notes bartender</h3>
      <p class="plante-notes-bar">${r.notes_bartender}</p>
    </div>` : ''}

${ingredients && ingredients.length > 0 ? (() => {
      const coutMaison = ingredients.reduce((total, ing) => {
        const prix = ing.ingredients_prix?.prix_unitaire || 0;
        return total + (prix * (ing.quantite || 0));
      }, 0);
      const coutCl = r.base_volume_cl ? (coutMaison / r.base_volume_cl).toFixed(2) : null;
      const economie = r.prix_marche_ref ? r.prix_marche_ref - coutMaison : null;
      return `
        <div class="plante-section">
          <h3>💶 Coût de revient</h3>
          <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
            ${ingredients.map(ing => `
              <div style="display:flex;justify-content:space-between;font-size:0.82rem;">
                <span style="color:var(--text-secondary)">${ing.nom} (${ing.quantite} ${ing.unite})</span>
                <span>${ing.ingredients_prix ? (ing.ingredients_prix.prix_unitaire * ing.quantite).toFixed(2) + '€' : '—'}</span>
              </div>`).join('')}
            <div style="border-top:1px solid var(--border);padding-top:8px;display:flex;justify-content:space-between;font-weight:600;">
              <span>Total maison (${r.base_volume_cl || '?'}cl)</span>
              <span>${coutMaison.toFixed(2)}€</span>
            </div>
            ${coutCl ? `<div style="font-size:0.78rem;color:var(--text-secondary)">Soit ${coutCl}€/cl</div>` : ''}
          </div>
          ${r.prix_marche_ref ? `
          <div style="background:var(--bg-success);border-radius:8px;padding:10px 12px;">
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px;">
              <span>Version achetée (${r.prix_marche_volume_cl || '?'}cl)</span>
              <span>${r.prix_marche_ref.toFixed(2)}€</span>
            </div>
            ${economie !== null ? `
            <div style="font-weight:700;color:var(--text-success);font-size:0.95rem;">
              ${economie > 0 ? '✅ Économie : ' + economie.toFixed(2) + '€' : '⚠️ Revient plus cher de ' + Math.abs(economie).toFixed(2) + '€'}
            </div>` : ''}
          </div>` : ''}
        </div>`;
    })() : ''}
   <div class="plante-section" style="margin-top:20px">
      <button class="btn-outline" style="width:100%;margin-bottom:8px" onclick="partagerGrimoire('${r.id}', '${r.nom.replace(/'/g, "\\'")}')">🔗 Partager</button>
      <button class="btn-primary" style="width:100%" onclick="lancerConcoction('${r.id}')">
        ⚗️ Lancer cette recette → Concoctions
      </button>
    </div>
  `;

  afficherModal('modal-fiche-grimoire');
}

async function partagerGrimoire(id, nom) {
  const url = `${window.location.origin}/grimoire-recette.html?id=${id}`;
  if (navigator.share) {
    try { await navigator.share({ title: nom, url }); }
    catch (e) { /* annulé par l'utilisateur */ }
  } else {
    await navigator.clipboard.writeText(url);
    alert('Lien copié ! ' + url);
  }
}

let configGrimoireCourant = null;
let configVolume = 50;
let configSucre = 'standard';

async function lancerConcoction(grimoireId) {
  if (grimoireList.length === 0) {
    const { data } = await db.from('grimoire').select('*').order('nom');
    if (data) grimoireList = data;
  }
  const r = grimoireList.find(x => x.id === grimoireId);
  if (!r) return;
  ouvrirConfigurateur(r);
  document.getElementById('modal-fiche-grimoire').classList.remove('visible');
}

function ouvrirConfigurateur(grimoire) {
  configGrimoireCourant = grimoire;
  configVolume = grimoire.base_volume_cl || 70;
  configSucre = 'standard';

  document.getElementById('config-grimoire-titre').textContent = grimoire.nom;
  document.getElementById('config-alcool-base').value = '';
  document.getElementById('config-date-debut').value = new Date().toISOString().split('T')[0];

  // Sélectionner le bon bouton volume
  document.querySelectorAll('#config-volume-btns .config-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.volume) === configVolume);
  });

  // Ajouter le volume de base si pas dans les options
  const volumes = [50, 70, 100, 150];
  if (!volumes.includes(configVolume)) {
    const btn = document.createElement('button');
    btn.className = 'config-btn active';
    btn.dataset.volume = configVolume;
    btn.textContent = configVolume + 'cl';
    btn.onclick = function() { selectConfigVolume(this); };
    document.getElementById('config-volume-btns').appendChild(btn);
  }

  mettreAJourRecap();
  afficherModal('modal-configurateur-grimoire');
}

function selectConfigVolume(btn) {
  document.querySelectorAll('#config-volume-btns .config-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  configVolume = parseInt(btn.dataset.volume);
  mettreAJourRecap();
}

function selectConfigSucre(btn) {
  document.querySelectorAll('#config-sucre-btns .config-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  configSucre = btn.dataset.sucre;
  mettreAJourRecap();
}

function mettreAJourRecap() {
  const r = configGrimoireCourant;
  if (!r) return;

  const ratioSucreLabel = { leger: '100g/L', standard: r.ratio_sucre || '200g/L', riche: '350g/L' };
  const sucreTotal = Math.round(configVolume * parseFloat(ratioSucreLabel[configSucre]) / 100);

  document.getElementById('config-recap').innerHTML = `
    <strong>Récapitulatif</strong><br>
    Volume : ${configVolume}cl<br>
    ${r.avec_alcool ? `Alcool de base : ${document.getElementById('config-alcool-base').value || r.base_volume_cl ? configVolume + 'cl' : '—'}<br>` : ''}
    ${r.ratio_sucre ? `Sucre estimé : ~${sucreTotal}g (${ratioSucreLabel[configSucre]})<br>` : ''}
    Durée : ${r.duree_jours || '—'} jours<br>
    Rendement estimé : ~${configVolume}cl
  `;
}

async function validerConfigurateur() {
  const r = configGrimoireCourant;
  if (!r) return;
  const alcoolBase = document.getElementById('config-alcool-base').value.trim();
  const dateDebut = document.getElementById('config-date-debut').value;
  const ratioSucreLabel = { leger: '100g/L', standard: r.ratio_sucre || '200g/L', riche: '350g/L' };

  const notes = [
    r.notes_bartender || '',
    alcoolBase ? `Alcool de base choisi : ${alcoolBase}` : '',
    `Volume configuré : ${configVolume}cl`,
    `Degré sucre : ${configSucre} (${ratioSucreLabel[configSucre]})`
  ].filter(Boolean).join('\n');

  const id = 'custom-conc-' + Date.now();
  const { data, error } = await db.from('concoctions').insert({
    id,
    user_id: currentUser.id,
    nom: r.nom,
    type: r.avec_alcool ? 'maceration' : 'infusion',
    description: r.description || '',
    date_creation: dateDebut,
    statut: 'en_cours',
    notes,
    grimoire_id: r.id
  }).select().single();


  if (!data) return;

  const debut = new Date(dateDebut);
  const duree = r.duree_jours || 14;
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + duree);
  const milieu = new Date(debut);
  milieu.setDate(milieu.getDate() + Math.floor(duree / 2));

  const etapesParCategorie = {
    maceration: [
      { ordre: 1, titre: 'Mise en macération', description: 'Placer les ingrédients dans le bocal hermétique avec l\'alcool. Fermer et placer à l\'abri de la lumière.', date: debut },
      { ordre: 2, titre: 'Vérification couleur et arômes', description: 'Goûter et observer la couleur. Ajuster si nécessaire.', date: milieu },
      { ordre: 3, titre: 'Filtration', description: 'Filtrer à travers une étamine fine. Presser légèrement pour extraire le maximum.', date: new Date(fin.getTime() - 2 * 86400000) },
      { ordre: 4, titre: 'Mise en bouteille', description: 'Transvaser dans une bouteille propre hermétique. Étiqueter avec la date et le contenu.', date: new Date(fin.getTime() - 86400000) },
      { ordre: 5, titre: 'Dégustation officielle', description: 'Première dégustation — noter les arômes, la couleur et l\'équilibre.', date: fin }
    ],
    liqueur: [
      { ordre: 1, titre: 'Mise en macération', description: 'Placer les ingrédients dans le bocal hermétique avec l\'alcool. Fermer et placer à l\'abri de la lumière.', date: debut },
      { ordre: 2, titre: 'Vérification couleur et arômes', description: 'Goûter et observer la couleur. Ajuster si nécessaire.', date: milieu },
      { ordre: 3, titre: 'Ajout du sucre', description: `Filtrer et ajouter le sirop simple selon le ratio : ${r.ratio_sucre || 'voir fiche Grimoire'}. Bien mélanger.`, date: new Date(fin.getTime() - 3 * 86400000) },
      { ordre: 4, titre: 'Filtration finale', description: 'Filtrer à nouveau finement. La liqueur doit être limpide.', date: new Date(fin.getTime() - 2 * 86400000) },
      { ordre: 5, titre: 'Mise en bouteille', description: 'Transvaser dans une bouteille propre hermétique. Étiqueter.', date: new Date(fin.getTime() - 86400000) },
      { ordre: 6, titre: 'Dégustation officielle', description: 'Première dégustation — noter les arômes, la couleur et l\'équilibre.', date: fin }
    ],
    'creme-de': [
      { ordre: 1, titre: 'Mise en macération', description: 'Placer les ingrédients dans le bocal hermétique avec l\'alcool.', date: debut },
      { ordre: 2, titre: 'Vérification', description: 'Goûter et observer. Ajuster si nécessaire.', date: milieu },
      { ordre: 3, titre: 'Ajout du sucre (ratio élevé)', description: `Filtrer et ajouter le sirop riche : ${r.ratio_sucre || 'minimum 400g/L'}. Bien mélanger.`, date: new Date(fin.getTime() - 2 * 86400000) },
      { ordre: 4, titre: 'Mise en bouteille', description: 'Transvaser dans une bouteille propre. Étiqueter avec date et ratio sucre.', date: new Date(fin.getTime() - 86400000) },
      { ordre: 5, titre: 'Dégustation officielle', description: 'Première dégustation.', date: fin }
    ],
    sirop: [
      { ordre: 1, titre: 'Préparation des ingrédients', description: 'Peser et préparer tous les ingrédients. Stériliser les contenants.', date: debut },
      { ordre: 2, titre: 'Infusion', description: 'Infuser les ingrédients dans l\'eau chaude selon la recette. Surveiller la durée.', date: debut },
      { ordre: 3, titre: 'Filtration', description: 'Filtrer finement à travers une étamine ou un filtre à café.', date: debut },
      { ordre: 4, titre: 'Mise en bouteille', description: 'Ajouter le sucre, mélanger jusqu\'à dissolution complète. Mettre en bouteille au frigo.', date: fin }
    ],
    shrub: [
      { ordre: 1, titre: 'Macération à froid', description: 'Mélanger les fruits avec le sucre. Laisser macérer 48h au frigo.', date: debut },
      { ordre: 2, titre: 'Ajout du vinaigre', description: 'Filtrer le jus obtenu et ajouter le vinaigre de cidre. Bien mélanger.', date: new Date(debut.getTime() + 2 * 86400000) },
      { ordre: 3, titre: 'Filtration et mise en bouteille', description: 'Filtrer finement et mettre en bouteille au frigo.', date: fin }
    ],
    teinture: [
      { ordre: 1, titre: 'Mise en macération', description: 'Placer les ingrédients dans l\'alcool fort (70°+). Fermer hermétiquement.', date: debut },
      { ordre: 2, titre: 'Vérification intensité', description: 'Goûter — très puissant. Ajuster la durée selon l\'intensité souhaitée.', date: milieu },
      { ordre: 3, titre: 'Filtration fine', description: 'Filtrer à travers étamine très fine ou filtre à café. Mettre en petite bouteille compte-gouttes.', date: fin }
    ],
    infusion: [
      { ordre: 1, titre: 'Préparation', description: 'Préparer les ingrédients. Stériliser les contenants.', date: debut },
      { ordre: 2, titre: 'Infusion', description: 'Infuser selon la recette du Grimoire. Surveiller la durée et la couleur.', date: debut },
      { ordre: 3, titre: 'Filtration et mise en bouteille', description: 'Filtrer et mettre en bouteille. Conserver au frigo.', date: fin }
    ]
  };

  const etapes = etapesParCategorie[r.categorie] || etapesParCategorie['maceration'];
  const etapesAInserer = etapes.map(e => ({
    concoction_id: data.id,
    user_id: currentUser.id,
    ordre: e.ordre,
    titre: e.titre,
    description: e.description,
    date_etape: e.date.toISOString().split('T')[0],
    faite: false
  }));

  await db.from('concoction_etapes').insert(etapesAInserer);

  document.getElementById('modal-configurateur-grimoire').classList.remove('visible');
  switchSousOngletConc('en-cours', document.querySelector('.conc-sous-onglet'));
  await chargerConcoctions();
}

async function chargerLexiqueConc() {
  const { data } = await db.from('connaissances_transversales')
    .select('*')
    .eq('type', 'lexique')
    .order('titre');
  const container = document.getElementById('conc-lexique-contenu');
  if (!container || !data) return;
  container.innerHTML = data.map(entry => `
    <div class="lexique-carte">
      <div class="lexique-titre">${entry.titre}</div>
      <div class="lexique-contenu">${entry.contenu}</div>
    </div>
  `).join('');
}
 
// =============================================
// CARTE PLANTE
// =============================================
 
function renderCartePlante(p) {
  const moisActuel = new Date().getMonth() + 1;
  const enSaison   = p.disponibilite_mois?.includes(moisActuel);
  const usageLabel = { decoration: 'Déco', infusion: 'Infusion', maceration: 'Macération', sirop: 'Sirop', muddle: 'Muddle', zeste: 'Zeste' };
 
  return `
    <div class="herbo-carte" onclick="ouvrirFichePlante('${p.id}')">
      <div class="herbo-carte-top">
        <span class="herbo-emoji">${p.emoji}</span>
        <div class="herbo-carte-info">
          <div class="herbo-nom">${p.nom}</div>
          ${p.nom_latin ? `<div class="herbo-latin">${p.nom_latin}</div>` : ''}
        </div>
        <span class="herbo-saison ${enSaison ? 'herbo-saison--ok' : 'herbo-saison--off'}">
          ${enSaison ? '● Dispo' : '○ Hors saison'}
        </span>
      </div>
      <div class="herbo-profil">${p.profil_aromatique || ''}</div>
      <div class="herbo-usages">
        ${(p.usages_bar || []).map(u => `<span class="herbo-usage-tag">${usageLabel[u] || u}</span>`).join('')}
      </div>
      ${p.cocktails_types?.length ? `
        <div class="herbo-cocktails">🍹 ${p.cocktails_types.slice(0, 3).join(' · ')}</div>
      ` : ''}
    </div>
  `;
}
 
// =============================================
// FICHE DÉTAILLÉE
// =============================================
 
function ouvrirFichePlante(id) {
  const p = plantesList.find(x => x.id === id);
  if (!p) return;
  plantesOuverte = p;
 
  const usageLabel = { decoration: 'Déco', infusion: 'Infusion', maceration: 'Macération', sirop: 'Sirop', muddle: 'Muddle', zeste: 'Zeste' };
  const moisNoms   = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const moisActuel = new Date().getMonth() + 1;
 
  document.querySelector('.plante-fiche-contenu').innerHTML = `
 
    <div class="plante-fiche-header">
      <span style="font-size:2.5rem">${p.emoji}</span>
      <div>
        <h2 class="fiche-titre">${p.nom}</h2>
        ${p.nom_latin ? `<div class="herbo-latin" style="font-size:0.85rem;margin-top:2px">${p.nom_latin}</div>` : ''}
      </div>
    </div>
 
    <div class="plante-section">
      <h3>Profil aromatique</h3>
      <p>${p.profil_aromatique || '—'}</p>
    </div>
 
    <div class="plante-section">
      <h3>Usages au bar</h3>
      <div class="herbo-usages" style="margin-bottom:10px">
        ${(p.usages_bar || []).map(u => `<span class="herbo-usage-tag herbo-usage-tag--large">${usageLabel[u] || u}</span>`).join('')}
      </div>
      ${p.notes_bartender ? `<p class="plante-notes-bar">${p.notes_bartender}</p>` : ''}
    </div>
 
    ${p.cocktails_types?.length ? `
    <div class="plante-section">
      <h3>Cocktails associés</h3>
      <div class="plante-cocktails-liste">
        ${p.cocktails_types.map(c => `<span class="plante-cocktail-chip">🍹 ${c}</span>`).join('')}
      </div>
    </div>` : ''}
 
    ${p.conservation_bar ? `
    <div class="plante-section">
      <h3>Conservation bar</h3>
      <p>${p.conservation_bar}</p>
    </div>` : ''}
 
    ${p.arrosage && p.arrosage !== 'Non applicable' ? `
    <div class="plante-section">
      <h3>Entretien</h3>
      <div class="plante-entretien-grid">
        <div class="plante-entretien-item">
          <span class="plante-entretien-icon">💧</span>
          <div><div class="plante-entretien-label">Arrosage</div><div class="plante-entretien-val">${p.arrosage}</div></div>
        </div>
        <div class="plante-entretien-item">
          <span class="plante-entretien-icon">☀️</span>
          <div><div class="plante-entretien-label">Lumière</div><div class="plante-entretien-val">${p.lumiere}</div></div>
        </div>
        <div class="plante-entretien-item">
          <span class="plante-entretien-icon">🪴</span>
          <div><div class="plante-entretien-label">Substrat</div><div class="plante-entretien-val">${p.substrat}</div></div>
        </div>
        ${p.taille && p.taille !== 'Non applicable' ? `
        <div class="plante-entretien-item">
          <span class="plante-entretien-icon">✂️</span>
          <div><div class="plante-entretien-label">Taille</div><div class="plante-entretien-val">${p.taille}</div></div>
        </div>` : ''}
      </div>
    </div>` : ''}
 
    ${p.periode_plantation && p.periode_plantation !== 'Non applicable' ? `
    <div class="plante-section">
      <h3>Calendrier — Sud-Ouest</h3>
      <div class="plante-calendrier">
        ${moisNoms.map((m, i) => {
          const mois  = i + 1;
          const dispo = p.disponibilite_mois?.includes(mois);
          const actuel = mois === moisActuel;
          return `<div class="plante-mois ${dispo ? 'plante-mois--dispo' : ''} ${actuel ? 'plante-mois--actuel' : ''}">${m}</div>`;
        }).join('')}
      </div>
      <div class="plante-calendrier-legend">
        ${p.periode_plantation ? `🌱 Planter : ${p.periode_plantation}` : ''}
        ${p.periode_recolte ? ` · ✂️ Récolter : ${p.periode_recolte}` : ''}
      </div>
    </div>` : ''}
 
   ${p.signes_problemes?.length ? `
    <div class="plante-section">
      <h3>Signes de problème</h3>
      <ul class="plante-problemes">
        ${p.signes_problemes.map(s => `<li>${s}</li>`).join('')}
      </ul>
    </div>` : ''}

    ${p.format_achat ? `
    <div class="plante-section">
      <h3>🛒 Format d'achat recommandé</h3>
      <p>${p.format_achat}</p>
      ${p.fourchette_prix ? `<div class="plante-prix">💶 ${p.fourchette_prix}</div>` : ''}
      ${p.sites_recommandes?.length ? `
      <div class="plante-sites">
        <div class="plante-sites-titre">Où acheter :</div>
        ${p.sites_recommandes.map(s => `<span class="plante-site-tag">${s}</span>`).join('')}
      </div>` : ''}
    </div>` : ''}

    ${p.format_a_fuir ? `
    <div class="plante-section">
      <h3>⚠️ À éviter</h3>
      <p class="plante-fuir">${p.format_a_fuir}</p>
    </div>` : ''}

   ${p.categories_preparation?.length ? `
    <div class="plante-section">
      <h3>🧪 Préparations possibles</h3>
      <div class="plante-preparations">
        ${p.categories_preparation.map(cat => `<span class="plante-prep-tag">${cat}</span>`).join('')}
      </div>
<div style="margin-top:12px;">
        <button class="btn-primary" style="width:100%" 
          data-categories='${JSON.stringify(p.categories_preparation || [])}'
          onclick="voirPreparationsGrimoire(this)">
          📖 Voir les recettes dans le Grimoire
        </button>
      </div>
    </div>` : ''}
  `;

  afficherModal('modal-fiche-plante');
}
function voirPreparationsGrimoire(btn) {
  const categories = JSON.parse(btn.dataset.categories || '[]');
  fermerModal('modal-fiche-plante');
  if (categories && categories.length > 0) {
    filtreGrimoireCategorie = categories[0];
filtreGrimoireAlcool = null;
  }
  document.querySelector('nav button[data-tab="concoctions"]').click();
  const btnGrimoire = document.querySelectorAll('.conc-sous-onglet')[1];
  switchSousOngletConc('grimoire', btnGrimoire);
}

let ecoleData = { alcools: [], techniques: [], materiels: [], lexique: [] };
let ecoleSection = 'alcools';
 
// =============================================
// CHARGEMENT
// =============================================
 async function chargerEcoleData() {
  if (ecoleData.alcools.length > 0) return; // déjà chargé
  const { data } = await db.from('ecole_alcools').select('id, nom, famille').order('ordre');
  if (data) ecoleData.alcools = data;
}
async function chargerEcole() {
  const container = document.getElementById('ecole-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Chargement…</div>';
 
const [{ data: alcools }, { data: techniques }, { data: materiels }, { data: lexique }, { data: garnitures }] = await Promise.all([
    db.from('ecole_alcools').select('*').order('ordre'),
    db.from('ecole_techniques').select('*').order('ordre'),
    db.from('ecole_materiels').select('*').order('ordre'),
    db.from('ecole_lexique').select('*').order('ordre'),
    db.from('ecole_garnitures').select('*').order('ordre')
  ]);
 
  ecoleData = {
    alcools:    alcools    || [],
    techniques: techniques || [],
    materiels:  materiels  || [],
    lexique:    lexique    || [],
    garnitures: garnitures || []
  };
 
  renderEcole();
}
 
// =============================================
// RENDU PRINCIPAL
// =============================================
 function ouvrirFicheEcole(section, id) {
  // Naviguer vers l'onglet École
  const btnEcole = document.querySelector('nav button[data-tab="ecole"]');
  if (btnEcole) btnEcole.click();
  // Attendre le chargement puis ouvrir la fiche
  setTimeout(() => {
    ecoleSection = section;
    renderEcole();
    setTimeout(() => ouvrirFicheAlcool(id), 100);
  }, 300);
}
function renderEcole() {
  const container = document.getElementById('ecole-container');
  if (!container) return;
 
const sections = [
    { id: 'alcools',    label: '🥃 Alcools' },
    { id: 'techniques', label: '🍹 Techniques' },
    { id: 'garnitures', label: '🍋 Garnitures' },
    { id: 'materiels',  label: '🔧 Matériels' },
    { id: 'lexique',    label: '📖 Lexique' }
  ];
 
  container.innerHTML = `
    <div class="ecole-nav">
      ${sections.map(s => `
        <button class="ecole-nav-btn ${ecoleSection === s.id ? 'active' : ''}"
          onclick="ecoleSection='${s.id}'; renderEcole()">
          ${s.label}
        </button>
      `).join('')}
    </div>
<div class="ecole-content">
      ${ecoleSection === 'alcools'    ? renderAlcools()    : ''}
      ${ecoleSection === 'techniques' ? renderTechniques() : ''}
      ${ecoleSection === 'garnitures' ? renderGarnitures() : ''}
      ${ecoleSection === 'materiels'  ? renderMateriels()  : ''}
      ${ecoleSection === 'lexique'    ? renderLexique()    : ''}
    </div>
  `;
}
 
// =============================================
// ALCOOLS
// =============================================
 
function renderAlcools() {
  const caveNoms = cave?.categories?.flatMap(c =>
    c.items.filter(i => i.detenu !== false).map(i => i.nom.toLowerCase())
  ) || [];
 
  return `<div class="ecole-grille">${ecoleData.alcools.map(a => {
    const dansCave = caveNoms.some(n =>
      a.nom.toLowerCase().split(' ').some(mot => n.includes(mot) && mot.length > 3)
    );
    return `
      <div class="ecole-carte" onclick="ouvrirFicheAlcool('${a.id}')">
        <div class="ecole-carte-top">
          <span class="ecole-emoji">${a.emoji}</span>
          <div class="ecole-carte-info">
            <div class="ecole-nom">${a.nom}</div>
            <div class="ecole-sous-types">${(a.sous_types || []).slice(0, 3).join(' · ')}</div>
          </div>
          ${dansCave ? '<span class="ecole-cave-badge">✓ Cave</span>' : ''}
        </div>
        <div class="ecole-profil">${a.profil || ''}</div>
        ${a.cocktails_types?.length ? `<div class="ecole-cocktails">🍹 ${a.cocktails_types.slice(0, 3).join(' · ')}</div>` : ''}
      </div>
    `;
  }).join('')}</div>`;
}
 
// =============================================
// TECHNIQUES
// =============================================
 
function renderTechniques() {
  const diffLabel = { facile: 'Facile', moyen: 'Moyen', avance: 'Avancé' };
  const diffClass = { facile: 'diff-facile', moyen: 'diff-moyen', avance: 'diff-avance' };
 
  return `<div class="ecole-grille">${ecoleData.techniques.map(t => `
    <div class="ecole-carte" onclick="ouvrirFicheTechnique('${t.id}')">
      <div class="ecole-carte-top">
        <span class="ecole-emoji">${t.emoji}</span>
        <div class="ecole-carte-info">
          <div class="ecole-nom">${t.nom}</div>
          <div class="ecole-sous-types">${(t.materiels || []).slice(0, 2).join(' · ')}</div>
        </div>
        <span class="carte-diff ${diffClass[t.difficulte] || ''}">${diffLabel[t.difficulte] || ''}</span>
      </div>
      <div class="ecole-profil">${t.description || ''}</div>
    </div>
  `).join('')}</div>`;
}
 // =============================================
// GARNITURES
// =============================================

function renderGarnitures() {
  setTimeout(() => {
    ecoleData.garnitures.forEach(g => chargerApercuVideoGarniture(g.id, g.video_url));
  }, 50);
  return `
    <div style="margin-bottom:12px">
      <button class="btn-outline" onclick="ouvrirAjoutGarniture()">+ Ajouter une garniture</button>
    </div>
    <div class="ecole-grille">
      ${ecoleData.garnitures.length === 0 ? '<div class="empty-state"><div class="empty-state-titre">Aucune garniture</div><div class="empty-state-texte">Ajoute des vidéos de techniques de garniture trouvées sur les réseaux.</div></div>' : ''}
      ${ecoleData.garnitures.map(g => `
        <div class="ecole-carte" onclick="ouvrirFicheGarniture('${g.id}')">
          <div id="garniture-thumb-${g.id}" style="width:100%;aspect-ratio:1;border-radius:8px;background:var(--bg-card);display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:8px">
            <span style="font-size:2rem">▶️</span>
          </div>
          <div class="ecole-nom">${g.nom}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function ouvrirAjoutGarniture() {
  const url = prompt('Colle le lien de la vidéo (YouTube, TikTok, Instagram) :');
  if (!url) return;
  const nom = prompt('Nom de cette garniture (ex: Rosace citron, Twist orange) :', `Garniture ${ecoleData.garnitures.length + 1}`);
  if (!nom) return;
  ajouterGarniture(nom, url);
}

async function ajouterGarniture(nom, videoUrl) {
  const id = 'garniture-' + Date.now();
  const { error } = await db.from('ecole_garnitures').insert({
    id, user_id: currentUser.id, nom, video_url: videoUrl, ordre: ecoleData.garnitures.length + 1
  });
  if (error) { alert('Erreur : ' + error.message); return; }
  await chargerEcole();
  ecoleSection = 'garnitures';
  renderEcole();
}

function ouvrirFicheGarniture(id) {
  const g = ecoleData.garnitures.find(x => x.id === id);
  if (!g) return;
  document.querySelector('.ecole-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2.5rem">🍋</span>
      <div>
        <input type="text" id="garniture-nom-input" value="${g.nom}" 
          style="font-size:1.1rem;font-weight:700;background:transparent;border:none;color:var(--text-primary);padding:2px 0;border-bottom:1px dashed var(--border)"
          onchange="renommerGarniture('${g.id}', this.value)">
      </div>
    </div>
<div class="plante-section" id="garniture-video-zone-${g.id}"></div>
<div class="plante-section">
      <label style="font-size:0.8rem;color:var(--text-secondary);display:block;margin-bottom:8px">Choisir la miniature</label>
      <div id="garniture-choix-miniatures-${g.id}" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px"></div>
    </div>
    <div class="plante-section">
      <button class="btn-danger" onclick="supprimerGarniture('${g.id}')">🗑️ Supprimer</button>
    </div>
  `;
  lancerLectureGarniture(g.id, g.video_url);
 afficherChoixMiniatures(g.id, g.video_url);
  afficherModal('modal-ecole-fiche');
  setTimeout(() => chargerApercuVideoGarniture(g.id, g.video_url), 50);
}

async function chargerApercuVideoGarniture(garnitureId, videoUrl) {
  const g = ecoleData.garnitures.find(x => x.id === garnitureId);
  if (g?.thumbnail_url) {
    const html = `<img src="${g.thumbnail_url}" style="width:100%;height:100%;object-fit:cover">`;
    const gridThumb = document.getElementById(`garniture-thumb-${garnitureId}`);
    const ficheThumb = document.getElementById(`garniture-fiche-thumb-${garnitureId}`);
    if (gridThumb) gridThumb.innerHTML = html;
    if (ficheThumb) ficheThumb.innerHTML = html;
    return;
  }
  let oembedUrl = null;
  if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
    oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
  } else if (videoUrl.includes('tiktok.com')) {
    oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
  }
  if (!oembedUrl) return;

  try {
    const res = await fetch(oembedUrl);
    if (!res.ok) return;
    const data = await res.json();
    if (data.thumbnail_url) {
      const html = `<img src="${data.thumbnail_url}" style="width:100%;height:100%;object-fit:cover">`;
      const gridThumb = document.getElementById(`garniture-thumb-${garnitureId}`);
      const ficheThumb = document.getElementById(`garniture-fiche-thumb-${garnitureId}`);
      if (gridThumb) gridThumb.innerHTML = html;
      if (ficheThumb) ficheThumb.innerHTML = html;
    }
  } catch (e) {}
}
function afficherChoixMiniatures(garnitureId, videoUrl) {
  const zone = document.getElementById(`garniture-choix-miniatures-${garnitureId}`);
  if (!zone) return;
  const ytId = extraireYoutubeId(videoUrl);
  if (!ytId) { zone.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted)">Choix de miniature disponible uniquement pour YouTube.</div>'; return; }

  const options = [0, 1, 2, 3].map(n => `https://img.youtube.com/vi/${ytId}/${n}.jpg`);
  zone.innerHTML = options.map((url, idx) => `
    <img src="${url}" onclick="definirMiniatureGarniture('${garnitureId}', '${url}')"
      style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid var(--border)"
      onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
  `).join('');
}

async function definirMiniatureGarniture(id, url) {
  await db.from('ecole_garnitures').update({ thumbnail_url: url }).eq('id', id).eq('user_id', currentUser.id);
  const g = ecoleData.garnitures.find(x => x.id === id);
  if (g) g.thumbnail_url = url;
  const gridThumb = document.getElementById(`garniture-thumb-${id}`);
  const ficheThumb = document.getElementById(`garniture-fiche-thumb-${id}`);
  const html = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
  if (gridThumb) gridThumb.innerHTML = html;
  if (ficheThumb) ficheThumb.innerHTML = html;
}
function extraireYoutubeId(url) {
  const match = url.match(/(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function lancerLectureGarniture(garnitureId, videoUrl) {
  const zone = document.getElementById(`garniture-video-zone-${garnitureId}`);
  if (!zone) return;

  const ytId = extraireYoutubeId(videoUrl);
  if (ytId) {
    zone.innerHTML = `
      <div style="position:relative;width:100%;max-width:280px;aspect-ratio:9/16;margin:0 auto;border-radius:10px;overflow:hidden">
        <iframe src="https://www.youtube.com/embed/${ytId}?playsinline=1"
          style="width:100%;height:100%;border:none" allow="autoplay; encrypted-media" allowfullscreen></iframe>
      </div>
    `;
  } else {
    window.open(videoUrl, '_blank');
  }
}
async function renommerGarniture(id, nouveauNom) {
  await db.from('ecole_garnitures').update({ nom: nouveauNom }).eq('id', id).eq('user_id', currentUser.id);
  const g = ecoleData.garnitures.find(x => x.id === id);
  if (g) g.nom = nouveauNom;
}

async function supprimerGarniture(id) {
  if (!confirm('Supprimer cette garniture ?')) return;
  await db.from('ecole_garnitures').delete().eq('id', id).eq('user_id', currentUser.id);
  fermerModal('modal-ecole-fiche');
  await chargerEcole();
  ecoleSection = 'garnitures';
  renderEcole();
}
// =============================================
// MATÉRIELS
// =============================================
 
function renderMateriels() {
  const groupes = {
    necessaire: '⭐ Essentiels',
    utile:      '👍 Utiles',
    folklore:   '🎭 Folklore'
  };
 
  return Object.entries(groupes).map(([cat, label]) => {
    const items = ecoleData.materiels.filter(m => m.categorie === cat);
    if (!items.length) return '';
    return `
      <div class="ecole-groupe">
        <div class="ecole-groupe-titre">${label}</div>
        ${items.map(m => `
<div class="ecole-materiel-item" onclick="ouvrirFicheMateriel('${m.id}')">
            ${m.photo_url
              ? `<img src="${m.photo_url}" alt="${m.nom}" class="ecole-materiel-thumb">`
              : `<span class="ecole-emoji" style="font-size:1.2rem">${m.emoji}</span>`
            }
            <div class="ecole-materiel-info">
              <div class="ecole-nom" style="font-size:0.88rem">${m.nom}</div>
              <div class="ecole-sous-types">${m.description || ''}</div>
            </div>
            ${m.prix_estime ? `<span class="item-prix">${m.prix_estime}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}
 
// =============================================
// LEXIQUE
// =============================================
 
function renderLexique() {
  const groupes = {
    commander:   '🗣 Commander au bar',
    bartenders:  '🍸 Entre bartenders',
    degustation: '👅 Dégustation'
  };
 
  return Object.entries(groupes).map(([cat, label]) => {
    const items = ecoleData.lexique.filter(l => l.categorie === cat);
    if (!items.length) return '';
    return `
      <div class="ecole-groupe">
        <div class="ecole-groupe-titre">${label}</div>
        ${items.map(l => `
          <div class="ecole-lexique-item">
            <div class="ecole-terme">${l.terme}</div>
            <div class="ecole-definition">${l.definition}</div>
            ${l.exemple ? `<div class="ecole-exemple">${l.exemple}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}
 
// =============================================
// FICHES DÉTAILLÉES
// =============================================
 
function ouvrirFicheAlcool(id) {
  const a = ecoleData.alcools.find(x => x.id === id);
  if (!a) return;
 
  document.querySelector('.ecole-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2.5rem">${a.emoji}</span>
      <div><h2 class="fiche-titre">${a.nom}</h2></div>
    </div>
    ${a.sous_types?.length ? `
    <div class="plante-section">
      <h3>Types</h3>
      <div class="plante-cocktails-liste">
        ${a.sous_types.map(s => `<span class="plante-cocktail-chip">${s}</span>`).join('')}
      </div>
    </div>` : ''}
    ${a.profil ? `<div class="plante-section"><h3>Profil</h3><p>${a.profil}</p></div>` : ''}
    ${a.histoire ? `<div class="plante-section"><h3>Histoire</h3><p>${a.histoire}</p></div>` : ''}
    ${a.production ? `<div class="plante-section"><h3>Production</h3><p>${a.production}</p></div>` : ''}
    ${a.regions ? `<div class="plante-section"><h3>Régions</h3><p>${a.regions}</p></div>` : ''}
    ${a.comment_boire ? `<div class="plante-section"><h3>Comment le boire</h3><p class="plante-notes-bar">${a.comment_boire}</p></div>` : ''}
    ${a.cocktails_types?.length ? `
    <div class="plante-section">
      <h3>Cocktails associés</h3>
      <div class="plante-cocktails-liste">
        ${a.cocktails_types.map(c => `<span class="plante-cocktail-chip">🍹 ${c}</span>`).join('')}
      </div>
    </div>` : ''}
  `;
  afficherModal('modal-ecole-fiche');
}
 
function ouvrirFicheTechnique(id) {
  const t = ecoleData.techniques.find(x => x.id === id);
  if (!t) return;
  const diffLabel = { facile: 'Facile', moyen: 'Moyen', avance: 'Avancé' };
  const diffClass = { facile: 'diff-facile', moyen: 'diff-moyen', avance: 'diff-avance' };

  document.querySelector('.ecole-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2.5rem">${t.emoji}</span>
      <div>
        <h2 class="fiche-titre">${t.nom}</h2>
        <span class="carte-diff ${diffClass[t.difficulte] || ''}" style="margin-top:6px;display:inline-block">
          ${diffLabel[t.difficulte] || ''}
        </span>
      </div>
    </div>
    ${t.description ? `<div class="plante-section"><h3>Description</h3><p>${t.description}</p></div>` : ''}
    ${t.quand ? `<div class="plante-section"><h3>Quand l'utiliser</h3><p>${t.quand}</p></div>` : ''}
    ${t.materiels?.length ? `
    <div class="plante-section">
      <h3>Matériels</h3>
      <div class="fiche-materiels">
        ${t.materiels.map(m => `<span class="tag-materiel">${m}</span>`).join('')}
      </div>
    </div>` : ''}
    ${t.etapes?.length ? `
    <div class="plante-section">
      <h3>Étapes</h3>
      <ol class="fiche-etapes">
        ${t.etapes.map(e => `<li class="etape-item"><div class="etape-desc">${e}</div></li>`).join('')}
      </ol>
    </div>` : ''}
    ${t.conseil_pro ? `<div class="plante-section"><h3>Conseil pro</h3><p class="plante-notes-bar">${t.conseil_pro}</p></div>` : ''}
    ${t.video_url ? `
    <div class="plante-section">
      <h3>Vidéo</h3>
      <div id="video-technique-container-${t.id}" style="border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;align-items:center;gap:12px;cursor:pointer"
        onclick="window.open('${t.video_url.replace(/'/g, "\\'")}', '_blank')">
        <div id="video-thumb-${t.id}" style="width:64px;height:64px;border-radius:8px;background:var(--bg-card);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
          <span style="font-size:1.5rem">▶️</span>
        </div>
        <div style="flex:1;min-width:0">
          <div id="video-titre-${t.id}" style="font-weight:600;font-size:0.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Voir la vidéo</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">Ouvre dans un nouvel onglet</div>
        </div>
      </div>
    </div>` : ''}
    ${t.id === 'fat-wash' ? `
    <div class="plante-section">
      <h3>Conservation</h3>
      <p>🧊 <strong>Réfrigérateur :</strong> 2 semaines dans un bocal hermétique.<br>
         ❄️ <strong>Congélateur :</strong> 3 mois — décongeler au frigo, ne pas recongeler.<br>
         ⚠️ Signes d'altération : trouble persistant à température ambiante, odeur rance, dépôt gras visible.</p>
    </div>
    <div class="plante-section">
      <h3>Préparations associées</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn" style="font-size:13px;padding:8px 14px;" onclick="fermerModal('modal-ecole-fiche'); ouvrirOnglet('recettes'); setTimeout(() => ouvrirRecette('prep-fat-wash'), 300)">
          🧈 Fat Wash Beurre Noisette-Jameson
        </button>
      </div>
    </div>` : ''}
  `;
  afficherModal('modal-ecole-fiche');
 if (t.video_url) setTimeout(() => chargerApercuVideoTechnique(t.id, t.video_url), 50);
}
async function chargerApercuVideoTechnique(techniqueId, videoUrl) {
  const thumbEl = document.getElementById(`video-thumb-${techniqueId}`);
  const titreEl = document.getElementById(`video-titre-${techniqueId}`);
  if (!thumbEl || !titreEl) return;

  let oembedUrl = null;
  if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
    oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
  } else if (videoUrl.includes('tiktok.com')) {
    oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
  }
  if (!oembedUrl) return;

  try {
    const res = await fetch(oembedUrl);
    if (!res.ok) return;
    const data = await res.json();
    if (data.title) titreEl.textContent = data.title;
    if (data.thumbnail_url) {
      thumbEl.innerHTML = `<img src="${data.thumbnail_url}" style="width:100%;height:100%;object-fit:cover">`;
    }
  } catch (e) {}
} 
function ouvrirFicheMateriel(id) {
  const m = ecoleData.materiels.find(x => x.id === id);
  if (!m) return;
 
 document.querySelector('.ecole-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2.5rem">${m.emoji}</span>
      <div><h2 class="fiche-titre">${m.nom}</h2></div>
    </div>
    ${m.photo_url ? `<div class="plante-section"><img src="${m.photo_url}" alt="${m.nom}" style="width:100%;border-radius:10px;border:1px solid var(--border);"></div>` : ''}
    ${m.description ? `<div class="plante-section"><h3>Description</h3><p>${m.description}</p></div>` : ''}
    ${m.pourquoi ? `<div class="plante-section"><h3>Pourquoi c'est important</h3><p class="plante-notes-bar">${m.pourquoi}</p></div>` : ''}
    ${m.prix_estime ? `<div class="plante-section"><h3>Prix indicatif</h3><p>${m.prix_estime}</p></div>` : ''}
  `;
  afficherModal('modal-ecole-fiche');
}
function ouvrirModalRealisation(portions) {
  const r = recetteOuverte;
  document.getElementById('choix-real-nom').textContent = r.nom;
  document.getElementById('choix-real-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('choix-real-portions').value = portions;
  document.getElementById('choix-confirmation').style.display = 'none';
  document.getElementById('btn-choix-decrementer').disabled = false;
  afficherModal('modal-choix-realisation');
}

function confirmerDecrementation() {
  document.getElementById('choix-confirmation').style.display = 'block';
  document.getElementById('btn-choix-decrementer').disabled = true;
}

function annulerConfirmation() {
  document.getElementById('choix-confirmation').style.display = 'none';
  document.getElementById('btn-choix-decrementer').disabled = false;
}

async function validerDecrementation() {
  const r = recetteOuverte;
  const date = document.getElementById('choix-real-date').value;
  const portions = parseInt(document.getElementById('choix-real-portions').value) || 1;
  await decrementerCave(r, portions);
  fermerModal('modal-choix-realisation');
  afficherToastRealisation(r.nom, date);
}

function lancerDepuisChoix() {
  const r = recetteOuverte;
  const date = document.getElementById('choix-real-date').value;
  const portions = parseInt(document.getElementById('choix-real-portions').value) || 1;
  fermerModal('modal-choix-realisation');
  const snapAjust = ajustementApplique ? { ...ajustementVals } : {};
  lancerDegustationAveugle(r, portions, date, snapAjust);
}


 
// =============================================
// DÉCRÉMENTER LA CAVE (extrait de marquerRealisee)
// =============================================
 
async function decrementerCave(r, portions) {
  const caveIds = getItemsCave();
  const updates = [];
 
  for (const ing of (r.ingredients || [])) {
    if (!ing.item_cave_id || !ing.quantite || !ing.unite) continue;
    if (!caveIds.has(ing.item_cave_id)) continue;
    if (ing.unite !== 'cl') continue;
 
    for (const cat of cave.categories) {
      const item = cat.items.find(i => i.id === ing.item_cave_id);
      if (item && item.cl_restants !== null) {
        const nouveau = Math.max(0, item.cl_restants - (ing.quantite * portions));
        updates.push({ item, nouveau });
      }
    }
  }
 
  for (const { item, nouveau } of updates) {
    await db.from('items').update({ cl_restants: nouveau }).eq('id', item.id).eq('user_id', currentUser.id);
    item.cl_restants = nouveau;
  }
}
 
// =============================================
// HISTORIQUE COMPLET (onglet ou page dédiée)
// =============================================
 
let realisationsCache = [];
 
async function chargerHistoriqueRealisations() {
  const { data } = await db.from('realisations')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('date', { ascending: false })
    .limit(50);
  realisationsCache = data || [];
  return realisationsCache;
}
 
// =============================================
// RENDU SECTION DASHBOARD — RÉALISATIONS
// =============================================
 
function renderDashboardRealisations(realisations) {
  if (!realisations || realisations.length === 0) {
    return `
      <div class="dash-card">
        <div class="dash-card-header">
          <span class="dash-card-titre">Dernières réalisations</span>
        </div>
        <div class="dash-empty">Aucune réalisation enregistrée. Utilisez le bouton "Réalisée" dans les fiches recettes.</div>
      </div>`;
  }
const total = realisations.length;
  return `
    <div class="dash-card">
      <div class="dash-card-header">
        <span class="dash-card-titre">Dernières réalisations</span>
        <button class="dash-link" onclick="ouvrirHistoriqueComplet()">Tout voir (${total})</button>
      </div>
      <div class="dash-realisations-liste">
        ${realisations.slice(0, 5).map(real => {
          const recette = recettes.find(r => r.id === real.recette_id);
          const dateStr = new Date(real.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
          return `
            <div class="dash-real-item" onclick="sectionRecette='cocktail'; ouvrirFicheRecette('${real.recette_id}'); document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active')); document.querySelectorAll('.tab-section').forEach(s=>s.classList.add('hidden')); document.querySelector('nav button[data-tab=recettes]').classList.add('active'); document.getElementById('section-recettes').classList.remove('hidden');">
              ${recette?.photo_url
                ? `<img src="${recette.photo_url}" class="dash-real-img" alt="${real.recette_nom}" loading="lazy" onerror="this.style.display='none'">`
                : `<div class="dash-real-img dash-real-img--fallback">${real.recette_nom.charAt(0)}</div>`}
              <div class="dash-real-info">
                <div class="dash-real-nom">${real.recette_nom}</div>
                <div class="dash-real-meta">${real.portions} verre${real.portions > 1 ? 's' : ''} · ${dateStr}</div>
                ${real.note ? `<div class="dash-real-note">${real.note}</div>` : ''}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}


 async function ouvrirFicheSaisonniere(planteId) {
  let plante = plantesList.find(p => p.id === planteId);
  if (!plante) {
    const { data } = await db.from('plantes').select('*').eq('id', planteId).single();
    if (!data) return;
    plante = data;
  }

  const recettesAssociees = grimoireList.filter(g =>
    g.plante_ids?.includes(plante.id) ||
    (plante.categories_preparation || []).some(cat => g.categorie === cat)
  );

  const catLabels = {
    'maceration': 'Macération', 'infusion': 'Infusion', 'liqueur': 'Liqueur',
    'creme-de': 'Crème de...', 'sirop': 'Sirop', 'cordial': 'Cordial',
    'shrub': 'Shrub', 'teinture': 'Teinture', 'oleosaccharum': 'Oléosaccharum'
  };

  const moisNoms = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const moisActuel = new Date().getMonth() + 1;

  document.querySelector('.grimoire-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2.5rem">${plante.emoji}</span>
      <div>
        <h2 class="fiche-titre">${plante.nom}</h2>
        <div class="herbo-latin">${plante.profil_aromatique || ''}</div>
      </div>
    </div>

    <div class="plante-section">
      <h3>📅 Disponibilité</h3>
      <div class="plante-calendrier">
        ${moisNoms.map((m, i) => {
          const mois = i + 1;
          const dispo = plante.disponibilite_mois?.includes(mois);
          const actuel = mois === moisActuel;
          return `<div class="plante-mois ${dispo ? 'plante-mois--dispo' : ''} ${actuel ? 'plante-mois--actuel' : ''}">${m}</div>`;
        }).join('')}
      </div>
      ${plante.periode_recolte ? `<div style="font-size:0.82rem;color:var(--text-secondary);margin-top:8px">✂️ Récolter : ${plante.periode_recolte}</div>` : ''}
    </div>

    ${plante.format_achat ? `
    <div class="plante-section">
      <h3>🛒 Format d'achat</h3>
      <p>${plante.format_achat}</p>
      ${plante.fourchette_prix ? `<div class="plante-prix">💶 ${plante.fourchette_prix}</div>` : ''}
    </div>` : ''}

    ${recettesAssociees.length > 0 ? `
    <div class="plante-section">
      <h3>📖 Recettes du Grimoire</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${recettesAssociees.map(r => `
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px;cursor:pointer"
            onclick="fermerModal('modal-fiche-grimoire'); ouvrirFicheGrimoire('${r.id}')">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-weight:600;font-size:0.9rem">${r.avec_alcool ? '🍶' : '🌿'} ${r.nom}</div>
              <span style="font-size:0.72rem;color:var(--text-secondary)">${catLabels[r.categorie] || r.categorie}</span>
            </div>
            <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px">
              ${r.duree_jours ? `⏱ ${r.duree_jours}j` : ''} ${r.rendement_cl ? `· 🧪 ${r.rendement_cl}cl` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>` : '<div class="plante-section"><p style="color:var(--text-secondary);font-size:0.85rem">Aucune recette Grimoire associée pour le moment.</p></div>'}
  `;

  afficherModal('modal-fiche-grimoire');
}
// =============================================
// MODAL HISTORIQUE COMPLET
// =============================================
 
async function ouvrirHistoriqueComplet() {
  const reals = await chargerHistoriqueRealisations();
  const modal = document.getElementById('modal-historique');
 
  const corps = modal.querySelector('.historique-corps');
  if (!reals.length) {
    corps.innerHTML = '<div class="dash-empty">Aucune réalisation enregistrée.</div>';
  } else {
    // Grouper par mois
    const groupes = {};
    reals.forEach(r => {
      const mois = new Date(r.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (!groupes[mois]) groupes[mois] = [];
      groupes[mois].push(r);
    });
 
    corps.innerHTML = Object.entries(groupes).map(([mois, items]) => `
      <div class="historique-mois">
        <div class="historique-mois-titre">${mois}</div>
        ${items.map(real => {
          const recette = recettes.find(r => r.id === real.recette_id);
          const dateStr = new Date(real.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
          return `
            <div class="historique-item">
              ${recette?.photo_url
                ? `<img src="${recette.photo_url}" class="dash-real-img" alt="${real.recette_nom}" loading="lazy" onerror="this.style.display='none'">`
                : `<div class="dash-real-img dash-real-img--fallback">${real.recette_nom.charAt(0)}</div>`}
              <div class="historique-item-info">
                <div class="dash-real-nom">${real.recette_nom}</div>
                <div class="dash-real-meta">${real.portions} verre${real.portions > 1 ? 's' : ''} · ${dateStr}</div>
                ${real.note ? `<div class="dash-real-note">"${real.note}"</div>` : ''}
              </div>
              <button class="btn-icon btn-supprimer" title="Supprimer" onclick="supprimerRealisation('${real.id}')">🗑</button>
            </div>`;
        }).join('')}
      </div>
    `).join('');
  }
 
  afficherModal('modal-historique');
}
 
async function supprimerRealisation(id) {
  if (!confirm('Supprimer cette réalisation ?')) return;
  await db.from('realisations').delete().eq('id', id).eq('user_id', currentUser.id);
  ouvrirHistoriqueComplet();
}

init();

// =============================================
// CURSEUR GUSTATIF — Panneau latéral
// =============================================

const REGLES_GUSTATIVES = {
  amer: {
    moins: [
      { seuil: -1, action: 'reduire', cible: ['campari','angostura','kahlua','bitter','amaro','fernet','kahlúa'], categorie_ids: ['bitters','a-acheter-bitters'], pct: 15, note: 'Réduire l\'amer principal' },
      { seuil: -2, action: 'sel', note: '1 pincée de sel fin — supprime la perception amère' },
      { seuil: -2, action: 'augmenter', cible: ['sirop','sucre','miel'], pct: 20, note: 'Compenser avec plus de sucrosité' },
      { seuil: -3, action: 'ai', note: 'Reformulation complète recommandée' }
    ],
    plus: [
      { seuil: 1, action: 'ajouter_fixe', ingredient: 'Angostura Aromatic', quantite: '1 dash', note: '1 dash Angostura Aromatic' },
      { seuil: 2, action: 'ajouter_fixe', ingredient: 'Angostura Aromatic', quantite: '2 dashs', note: '2 dashs Angostura Aromatic' },
      { seuil: 3, action: 'ai', note: 'Envisager Fernet ou Amaro' }
    ]
  },
  sucre: {
    moins: [
      { seuil: -1, action: 'reduire', cible: ['sirop','sucre','miel','grenadine','orgeat'], pct: 30, note: 'Réduire l\'apport sucré' },
      { seuil: -2, action: 'reduire', cible: ['cointreau','triple sec','curacao','liqueur'], pct: 15, note: 'Réduire légèrement la liqueur sucrée' },
      { seuil: -3, action: 'ai', note: 'Supprimer sirop, ajuster liqueur' }
    ],
    plus: [
      { seuil: 1, action: 'augmenter', cible: ['sirop','sucre'], pct: 30, note: 'Augmenter le sirop de sucre' },
      { seuil: 2, action: 'ajouter_fixe', ingredient: 'Sirop de sucre', quantite: '0.5cl', note: 'Ajouter 0.5cl de sirop' },
      { seuil: 3, action: 'sub', note: 'Option : sirop de miel ou agave pour plus de complexité' }
    ]
  },
  acide: {
    moins: [
      { seuil: -1, action: 'reduire', cible: ['citron','lime','jus de citron','jus de lime'], pct: 15, note: 'Réduire légèrement l\'agrume' },
      { seuil: -2, action: 'sel', note: '1 pincée de sel — atténue la perception acide' },
      { seuil: -2, action: 'augmenter', cible: ['sirop','sucre'], pct: 20, note: 'Compenser avec plus de sucre' }
    ],
    plus: [
      { seuil: 1, action: 'augmenter', cible: ['citron','lime','jus'], pct: 15, note: 'Augmenter le jus d\'agrume' },
      { seuil: 2, action: 'ajouter_fixe', ingredient: 'Jus de citron', quantite: '0.5cl', note: 'Ajouter 0.5cl de jus de citron' }
    ]
  },
  fort: {
    moins: [
      { seuil: -1, action: 'reduire',
        cible: ['vodka','gin','whisky','rhum','mezcal','tequila','cognac','armagnac','bourbon','rye','brandy','pisco','calvados'],
        categorie_ids: ['vodka','gin','whisky','rhum','mezcal-tequila','eaux-de-vie','a-acheter-spirits'],
        pct: 10, note: 'Réduire le spiritueux de 10%' },
      { seuil: -2, action: 'reduire',
        cible: ['vodka','gin','whisky','rhum','mezcal','tequila','cognac','armagnac','bourbon','rye','brandy','pisco','calvados'],
        categorie_ids: ['vodka','gin','whisky','rhum','mezcal-tequila','eaux-de-vie','a-acheter-spirits'],
        pct: 20, note: 'Réduire le spiritueux de 20%' },
      { seuil: -3, action: 'ai', note: 'Version allégée — compenser avec plus de mixer' }
    ],
    plus: [
      { seuil: 1, action: 'augmenter',
        cible: ['vodka','gin','whisky','rhum','mezcal','tequila','cognac','armagnac','bourbon','rye','brandy','pisco','calvados'],
        categorie_ids: ['vodka','gin','whisky','rhum','mezcal-tequila','eaux-de-vie','a-acheter-spirits'],
        pct: 10, note: 'Augmenter le spiritueux de 10%' },
      { seuil: 2, action: 'augmenter',
        cible: ['vodka','gin','whisky','rhum','mezcal','tequila','cognac','armagnac','bourbon','rye','brandy','pisco','calvados'],
        categorie_ids: ['vodka','gin','whisky','rhum','mezcal-tequila','eaux-de-vie','a-acheter-spirits'],
        pct: 20, note: 'Version plus corsée (+20%)' },
      { seuil: 3, action: 'ai', note: 'Option overproof ou Navy Strength' }
    ]
  },
  fruite: {
    moins: [
      { seuil: -1, action: 'reduire', cible: ['jus','framboise','fraise','mangue','ananas','grenadine'], pct: 20, note: 'Réduire l\'apport fruité' }
    ],
    plus: [
      { seuil: 1, action: 'augmenter', cible: ['jus','framboise','fraise','mangue','ananas'], pct: 20, note: 'Augmenter l\'apport fruité' },
      { seuil: 2, action: 'ajouter_fixe', ingredient: 'Jus de fruit frais', quantite: '1cl', note: 'Ajouter 1cl de jus de fruit frais' }
    ]
  },
  cremeux: {
    moins: [
      { seuil: -1, action: 'reduire', cible: ['creme','aquafaba','blanc','oeuf'], pct: 30, note: 'Réduire l\'agent crémeux' },
      { seuil: -3, action: 'supprimer', cible: ['creme','aquafaba','blanc','oeuf'], note: 'Supprimer — texture plus liquide' }
    ],
    plus: [
      { seuil: 1, action: 'augmenter', cible: ['creme','aquafaba','blanc'], pct: 30, note: 'Augmenter l\'agent crémeux' },
      { seuil: 2, action: 'sub', note: 'Blanc d\'œuf à la place de l\'aquafaba — mousse plus dense' }
    ]
  }
};

const AXES = [
  { id: 'amer',   label: 'Amer' },
  { id: 'sucre',  label: 'Sucré' },
  { id: 'acide',  label: 'Acide' },
  { id: 'fort',   label: 'Force' },
  { id: 'fruite', label: 'Fruité' },
  { id: 'cremeux',label: 'Crémeux' }
];

let ajustementVals = { amer: 0, sucre: 0, acide: 0, fort: 0, fruite: 0, cremeux: 0 };
let ajustementValsOriginaux = { amer: 0, sucre: 0, acide: 0, fort: 0, fruite: 0, cremeux: 0 };
let ajustementRecette = null;
let ajustementApplique = null;
let ajustementPortions = 1;

function ouvrirPanneauAjustement(recetteId) {
  ajustementRecette = recettes.find(r => r.id === recetteId);
  if (!ajustementRecette) return;
  // Toujours repartir des ingrédients BDD — ignorer tout ajustement précédent
  ajustementApplique = null;
  if (recetteOuverte) recetteOuverte._ajuste = null;

  // Pré-remplir les curseurs selon le profil gustatif de la recette
  // Neutre = 5/10, on ramène sur échelle -3/+3
  const r = ajustementRecette;
  const toSlider = (val) => val ? Math.round((val - 5) * 3 / 5) : 0;
  ajustementVals = {
    amer:    toSlider(r.gout_amer),
    sucre:   toSlider(r.gout_sucre),
    acide:   toSlider(r.gout_acide),
    fruite:  toSlider(r.gout_fruite),
    fort:    0,
    cremeux: toSlider(r.gout_cremeux)
  };

  // Sauvegarder les valeurs originales pour le marqueur et le reset
  ajustementValsOriginaux = { ...ajustementVals };

  // Portions
  ajustementPortions = 1;

  const panneau = document.getElementById('panneau-ajustement');
  panneau.querySelector('.panneau-titre-recette').textContent = ajustementRecette.nom;
  panneau.classList.add('visible');
  document.getElementById('panneau-overlay').classList.add('visible');

  // Mettre à jour les sliders
  AXES.forEach(ax => {
    const v = ajustementVals[ax.id] || 0;
    const slider = document.getElementById(`adj-${ax.id}`);
    if (slider) slider.value = v;
    const valEl = document.getElementById(`adj-val-${ax.id}`);
    if (valEl) {
      valEl.textContent = v > 0 ? '+' + v : v;
      valEl.style.color = v > 0 ? '#4caf7d' : v < 0 ? '#e24b4a' : 'var(--text-muted)';
    }
  });

  // Portions slider
  const portSlider = document.getElementById('adj-portions-slider');
  const portVal = document.getElementById('adj-portions-val');
  if (portSlider) portSlider.value = 1;
  if (portVal) portVal.textContent = '1';

  calculerAjustements();
  updateMarqueursOriginaux();
}

function fermerPanneauAjustement() {
  document.getElementById('panneau-ajustement').classList.remove('visible');
  document.getElementById('panneau-overlay').classList.remove('visible');
}

function onAdjSlider(axe, val) {
  ajustementVals[axe] = parseInt(val);
  const el = document.getElementById(`adj-val-${axe}`);
  if (el) {
    el.textContent = val > 0 ? '+' + val : val;
    el.style.color = val > 0 ? '#4caf7d' : val < 0 ? '#e24b4a' : 'var(--text-muted)';
  }
  calculerAjustements();
  updateMarqueursOriginaux();
}

function calculerAjustements() {
  if (!ajustementRecette) return;

  const ings = (ajustementRecette.ingredients || []).map(i => ({ ...i, cl_ajuste: i.quantite }));
  const ajustements = [];
  let needsAI = false;
  let ajoutSel = false;

  Object.entries(ajustementVals).forEach(([axe, val]) => {
    const origVal = ajustementValsOriginaux[axe] || 0;
    const delta = val - origVal; // écart par rapport à la recette originale
    if (delta === 0) return;
    const direction = delta < 0 ? 'moins' : 'plus';
    const regles = REGLES_GUSTATIVES[axe]?.[direction] || [];

    regles.forEach(regle => {
      const abs = Math.abs(delta);
      if (abs < Math.abs(regle.seuil)) return;

      if (regle.action === 'ai') { needsAI = true; return; }
      if (regle.action === 'sel') { if (!ajoutSel) { ajoutSel = true; ajustements.push({ type: 'sel', texte: regle.note }); } return; }
      if (regle.action === 'sub') { ajustements.push({ type: 'sub', texte: regle.note }); return; }
      if (regle.action === 'ajouter_fixe') { ajustements.push({ type: 'add', texte: `+ ${regle.quantite} ${regle.ingredient}` }); return; }

      if (regle.cible) {
        ings.forEach(ing => {
          const nomLower = ing.nom.toLowerCase();
          // Matching par nom ET par category_id de l'item en cave
          const itemCave = ing.item_cave_id
            ? cave?.categories?.flatMap(c => c.items).find(i => i.id === ing.item_cave_id)
            : null;
          const catId = itemCave?.category_id || '';
          const matchNom = regle.cible.some(c => nomLower.includes(c));
          const matchCat = regle.categorie_ids
            ? regle.categorie_ids.some(c => catId.includes(c))
            : false;
          const match = matchNom || matchCat;
          if (!match || !ing.quantite) return;

          if (regle.action === 'reduire') {
            ing.cl_ajuste = Math.max(0.2, ing.quantite * (1 - regle.pct / 100));
            ajustements.push({ type: 'remove', texte: `${ing.nom} : ${ing.quantite}cl → ${ing.cl_ajuste.toFixed(1)}cl` });
          } else if (regle.action === 'augmenter') {
            ing.cl_ajuste = ing.quantite * (1 + regle.pct / 100);
            ajustements.push({ type: 'add', texte: `${ing.nom} : ${ing.quantite}cl → ${ing.cl_ajuste.toFixed(1)}cl` });
          } else if (regle.action === 'supprimer') {
            ing.cl_ajuste = 0;
            ajustements.push({ type: 'remove', texte: `${ing.nom} supprimé` });
          }
        });
      }
    });
  });

  const totalModif = Object.values(ajustementVals).reduce((s, v) => s + Math.abs(v), 0);
  if (totalModif >= 8) needsAI = true;

  // Rendu recette ajustée avec portions
  const recetteDiv = document.getElementById('adj-recette');
  const p = ajustementPortions || 1;
  if (recetteDiv) {
    recetteDiv.innerHTML = ings.map(ing => {
      const modif = ing.cl_ajuste && Math.abs(ing.cl_ajuste - (ing.quantite || 0)) > 0.05;
      const qte1 = ing.cl_ajuste ? ing.cl_ajuste.toFixed(1) : (ing.quantite || '—');
      const qtep = ing.cl_ajuste ? (ing.cl_ajuste * p).toFixed(1) : (ing.quantite ? (ing.quantite * p).toFixed(1) : '—');
      const unite = ing.unite || '';
      const isVol = unite === 'cl';
      return `<div class="adj-ing-row">
        <span class="adj-ing-nom">${ing.nom}</span>
        <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
          <span class="adj-ing-qte ${modif ? 'adj-ing-qte--modif' : ''}">${isVol ? qte1 + ' cl' : (ing.quantite || '—') + (unite ? ' ' + unite : '')}</span>
          ${p > 1 && isVol ? `<span class="adj-ing-qte-portions">${qtep} cl</span>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  // Rendu ajustements
  const adjDiv = document.getElementById('adj-liste');
  const typeClass = { add: 'adj-note--add', remove: 'adj-note--remove', sub: 'adj-note--sub', sel: 'adj-note--sel' };
  if (adjDiv) {
    adjDiv.innerHTML = ajustements.length
      ? ajustements.map(a => `<div class="adj-note ${typeClass[a.type] || ''}">${a.texte}</div>`).join('')
      : '<div class="adj-note-vide">Recette originale — déplacez les curseurs</div>';
  }

  // Bouton AI
  const aiBtn = document.getElementById('adj-ai-btn');
  if (aiBtn) aiBtn.style.display = needsAI ? 'block' : 'none';
}

function resetAjustements() {
  ajustementVals = { ...ajustementValsOriginaux };
  AXES.forEach(ax => {
    const v = ajustementVals[ax.id] || 0;
    const s = document.getElementById(`adj-${ax.id}`);
    if (s) s.value = v;
    const el = document.getElementById(`adj-val-${ax.id}`);
    if (el) {
      el.textContent = v > 0 ? '+' + v : v;
      el.style.color = v > 0 ? '#4caf7d' : v < 0 ? '#e24b4a' : 'var(--text-muted)';
    }
  });
  const portSlider = document.getElementById('adj-portions-slider');
  const portVal = document.getElementById('adj-portions-val');
  if (portSlider) portSlider.value = 1;
  if (portVal) portVal.textContent = '1';
  ajustementPortions = 1;
  calculerAjustements();
  updateMarqueursOriginaux();
}

function updateMarqueursOriginaux() {
  AXES.forEach(ax => {
    const marqueur = document.getElementById(`adj-marqueur-${ax.id}`);
    if (!marqueur) return;

    const origVal = ajustementValsOriginaux[ax.id] || 0;
    const currentVal = ajustementVals[ax.id] || 0;

    // Position en % sur l'échelle -3 à +3 avec compensation thumb
    const pct = ((origVal + 3) / 6) * 100;
    marqueur.style.left = `calc(${pct}% + (0.5 - ${pct / 100}) * 14px)`;

    // Toujours visible si origVal != 0 (position initiale non centrale)
    // Même si l'utilisateur n'a pas encore bougé
    marqueur.style.opacity = origVal !== 0 ? '1' : (currentVal !== origVal ? '1' : '0');
  });
}

function onAdjPortions(val) {
  ajustementPortions = parseInt(val) || 1;
  document.getElementById('adj-portions-val').textContent = val;
  calculerAjustements();
}

function appliquerAjustements() {
  if (!ajustementRecette) return;
  // Recalculer les ingrédients ajustés
  const ings = (ajustementRecette.ingredients || []).map(i => ({ ...i, cl_ajuste: i.quantite }));
  // Appliquer les règles (copie de calculerAjustements sans le rendu)
  let ajoutSel = false;
  Object.entries(ajustementVals).forEach(([axe, val]) => {
    if (val === 0) return;
    const direction = val < 0 ? 'moins' : 'plus';
    const regles = REGLES_GUSTATIVES[axe]?.[direction] || [];
    regles.forEach(regle => {
      const abs = Math.abs(val);
      if (abs < Math.abs(regle.seuil)) return;
      if (['ai','sel','sub','ajouter_fixe'].includes(regle.action)) return;
      if (regle.cible) {
        ings.forEach(ing => {
          const nomLower = ing.nom.toLowerCase();
          const itemCave = ing.item_cave_id ? cave?.categories?.flatMap(c => c.items).find(i => i.id === ing.item_cave_id) : null;
          const catId = itemCave?.category_id || '';
          const matchNom = regle.cible.some(c => nomLower.includes(c));
          const matchCat = regle.categorie_ids ? regle.categorie_ids.some(c => catId.includes(c)) : false;
          if (!(matchNom || matchCat) || !ing.quantite) return;
          if (regle.action === 'reduire') ing.cl_ajuste = Math.max(0.2, ing.quantite * (1 - regle.pct / 100));
          else if (regle.action === 'augmenter') ing.cl_ajuste = ing.quantite * (1 + regle.pct / 100);
          else if (regle.action === 'supprimer') ing.cl_ajuste = 0;
        });
      }
    });
  });

  ajustementApplique = { ings, portions: ajustementPortions };
  fermerPanneauAjustement();
  // Re-render la fiche avec la version ajustée
  renderFicheAjustee(ajustementPortions);
}

function renderFicheAjustee(portions) {
  // Re-render la fiche avec bandeau orange et dosages ajustés
  recetteOuverte._ajuste = ajustementApplique;
  renderFiche(portions);
}

function annulerAjustements() {
  ajustementApplique = null;
  recetteOuverte._ajuste = null;
  renderFiche(1);
}

async function demanderAjustementAI() {
  if (!ajustementRecette) return;
  const btn = document.getElementById('adj-ai-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Analyse en cours…';

  const ingsDesc = (ajustementRecette.ingredients || []).map(i => `${i.nom} ${i.quantite || ''}${i.unite || ''}`).join(', ');
  const ajustDesc = Object.entries(ajustementVals)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`)
    .join(', ');

  try {
    const response = await fetch('/api/apport', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caveNoms: `Recette: ${ajustementRecette.nom}. Ingrédients: ${ingsDesc}`,
        manquantsTop: `Ajustements demandés: ${ajustDesc}. Propose une reformulation complète des dosages et substitutions si nécessaire. Réponds en JSON: [{"nom": "ingrédient", "apport": "dosage ajusté et raison"}]`
      })
    });
    const items = await response.json();
    const adjDiv = document.getElementById('adj-liste');
    if (adjDiv && items.length) {
      adjDiv.innerHTML += items.map(i =>
        `<div class="adj-note adj-note--ai"><strong>${i.nom}</strong> — ${i.apport}</div>`
      ).join('');
    }
  } catch (e) {
    console.error('Erreur AI ajustement:', e);
  }

  btn.disabled = false;
  btn.textContent = '✨ Reformulation Claude';
}

function afficherToastRealisation(nom, date) {
  const feedback = document.createElement('div');
  feedback.className = 'toast-feedback';
  feedback.textContent = `✓ ${nom} — réalisé le ${new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  document.body.appendChild(feedback);
  setTimeout(() => feedback.classList.add('visible'), 50);
  setTimeout(() => { feedback.classList.remove('visible'); setTimeout(() => feedback.remove(), 300); }, 3000);
  renderCave();
}

// =============================================
// MODE DÉGUSTATION À L'AVEUGLE
// =============================================

const DEG_ETAPES = [
  {
    titre: '👁 Visuel',
    curseur: { min: 'Clair', max: 'Foncé', key: 'visuel_intensite' },
    question: 'Quelle texture ?',
    choix: ['Limpide', 'Trouble', 'Mousseux', 'Huileux'],
    key: 'visuel_texture'
  },
  {
    titre: '👃 Nez',
    curseur: { min: 'Discret', max: 'Puissant', key: 'nez_intensite' },
    question: 'Famille dominante ?',
    choix: ['Fruité', 'Floral', 'Boisé', 'Épicé', 'Fumé', 'Herbacé'],
    key: 'nez_famille'
  },
  {
    titre: '👄 Bouche',
    curseur: { min: 'Léger', max: 'Corsé', key: 'bouche_intensite' },
    question: 'Sensation dominante ?',
    choix: ['Sucré', 'Amer', 'Acide', 'Rond', 'Sec', 'Pétillant'],
    key: 'bouche_sensation'
  },
  {
    titre: '✨ Finish',
    curseur: { min: 'Court', max: 'Long', key: 'finish_intensite' },
    question: 'Caractère ?',
    choix: ['Chaleureux', 'Fruité', 'Fumé', 'Frais', 'Amer', 'Poivré'],
    key: 'finish_caractere'
  }
];

let degustationState = {
  recette: null, portions: 0, date: null,
  verreActuel: 1, etapeActuelle: 0,
  reponses: {}, revealed: false
};

function lancerDegustationAveugle(recette, portions, date, ajustementSnapshot = {}) {
  degustationState = {
    recette, portions, date,
    ajustementSnapshot,
    verreActuel: 1, etapeActuelle: 0,
    reponses: {}, revealed: false
  };
const modal = document.getElementById('modal-degustation-aveugle');
modal.style.display = '';
modal.classList.add('visible');
  renderEtapeDegustation();
}

function fermerDegustation() {
  document.getElementById('modal-degustation-aveugle').style.display = 'none';
  afficherToastRealisation(degustationState.recette.nom, degustationState.date);
 document.getElementById('modal-degustation-aveugle').classList.remove('visible');
}

function renderEtapeDegustation() {
  const { etapeActuelle, verreActuel, portions, reponses, revealed } = degustationState;
  const label = document.getElementById('degustation-verre-label');
  label.textContent = portions > 1 ? `Verre ${verreActuel} / ${portions}` : '';
  document.querySelectorAll('.deg-prog-step').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < etapeActuelle) el.classList.add('done');
    else if (i === etapeActuelle) el.classList.add('active');
  });
  document.getElementById('btn-deg-precedent').style.display = etapeActuelle === 0 ? 'none' : 'block';
  const corps = document.getElementById('degustation-corps');
  const isReveal = etapeActuelle === DEG_ETAPES.length;
  document.getElementById('btn-deg-suivant').textContent = isReveal ? '✓ Terminer' : (etapeActuelle === DEG_ETAPES.length - 1 ? 'Révéler →' : 'Suivant →');
  if (isReveal) {
    corps.innerHTML = renderRevelation();
    return;
  }
  const etape = DEG_ETAPES[etapeActuelle];
  const valCurseur = reponses[etape.curseur.key] ?? 5;
  const valChoix = reponses[etape.key] ?? null;
  corps.innerHTML = `
    <div style="font-size:22px;font-weight:500;margin-bottom:20px;color:var(--text-primary);">${etape.titre}</div>
    <label style="font-size:13px;color:var(--text-secondary);">Intensité</label>
    <input type="range" min="1" max="10" value="${valCurseur}" step="1" style="width:100%;margin:8px 0 0;"
      oninput="degustationState.reponses['${etape.curseur.key}'] = parseInt(this.value)">
    <div class="deg-curseur-label"><span>${etape.curseur.min}</span><span>${etape.curseur.max}</span></div>
    <div class="deg-question">${etape.question}</div>
    <div class="deg-choix-grid">
      ${etape.choix.map(c => `
        <button class="deg-choix-btn ${valChoix === c ? 'selected' : ''}"
          onclick="selectDegChoix('${etape.key}', '${c}', this)">${c}</button>
      `).join('')}
    </div>
  `;
}

function selectDegChoix(key, valeur, btn) {
  degustationState.reponses[key] = valeur;
  btn.closest('.deg-choix-grid').querySelectorAll('.deg-choix-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function degustationSuivant() {
  const { etapeActuelle, verreActuel, portions, recette, date, reponses } = degustationState;
  if (etapeActuelle === DEG_ETAPES.length) {
    sauvegarderDegustation();
    return;
  }
  degustationState.etapeActuelle++;
  renderEtapeDegustation();
}

function degustationPrecedent() {
  if (degustationState.etapeActuelle > 0) {
    degustationState.etapeActuelle--;
    renderEtapeDegustation();
  }
}

async function sauvegarderDegustation() {
  const { recette, date, verreActuel, portions, reponses } = degustationState;
  const noteObj = { degustation_aveugle: reponses };
  await db.from('realisations').insert({
    user_id: currentUser.id,
    recette_id: recette.id,
    recette_nom: recette.nom,
    date,
    portions: 1,
    note: JSON.stringify(noteObj),
    photo_url: null
  });
  if (verreActuel < portions) {
    degustationState.verreActuel++;
    degustationState.etapeActuelle = 0;
    degustationState.reponses = {};
    renderEtapeDegustation();
  } else {
    fermerDegustation();
  }
}

function renderRevelation() {
  const r = degustationState.recette;
  const ajust = degustationState.ajustementSnapshot || {};
  const reponses = degustationState.reponses;

  // Profil de référence — ajusté si actif, brut sinon
  const profil = {
    sucre:  (r.gout_sucre  || 0) + (ajust.sucre  || 0),
    amer:   (r.gout_amer   || 0) + (ajust.amer   || 0),
    acide:  (r.gout_acide  || 0) + (ajust.acide  || 0),
    fruite: (r.gout_fruite || 0) + (ajust.fruite || 0),
    fume:   (r.gout_fume   || 0),
    floral: (r.gout_floral || 0),
    epice:  (r.gout_epice  || 0),
    cremeux:(r.gout_cremeux|| 0) + (ajust.cremeux|| 0),
  };

  // Famille dominante par étape (nez, bouche, finish)
  const famillesToAxe = {
    'Fruité': 'fruite', 'Floral': 'floral', 'Boisé': 'epice',
    'Épicé': 'epice', 'Fumé': 'fume', 'Herbacé': 'floral',
    'Sucré': 'sucre', 'Amer': 'amer', 'Acide': 'acide',
    'Rond': 'cremeux', 'Sec': 'amer', 'Pétillant': 'fruite',
    'Chaleureux': 'epice', 'Fruité': 'fruite', 'Frais': 'acide',
    'Poivré': 'epice'
  };

  // Axe dominant réel
  const axeDominant = Object.entries(profil).sort((a,b) => b[1]-a[1])[0];

  // SCORE
  let score = 0;

  // Nez famille (15 pts)
  const nezChoix = reponses['nez_famille'];
  const nezAxe = famillesToAxe[nezChoix];
  if (nezAxe && profil[nezAxe] >= 2) score += 15;
  else if (nezAxe && profil[nezAxe] >= 0) score += 7;

  // Bouche famille (15 pts)
  const boucheChoix = reponses['bouche_sensation'];
  const boucheAxe = famillesToAxe[boucheChoix];
  if (boucheAxe && profil[boucheAxe] >= 2) score += 15;
  else if (boucheAxe && profil[boucheAxe] >= 0) score += 7;

  // Finish famille (15 pts)
  const finishChoix = reponses['finish_caractere'];
  const finishAxe = famillesToAxe[finishChoix];
  if (finishAxe && profil[finishAxe] >= 1) score += 15;
  else if (finishAxe && profil[finishAxe] >= 0) score += 7;

  // Visuel texture (15 pts — approximatif)
  const visuelChoix = reponses['visuel_texture'];
  if (visuelChoix) score += 10; // toujours partiellement valide

  // Curseurs intensité (10 pts × 4)
  const intensiteRef = Math.round(
    (Math.abs(profil.sucre) + Math.abs(profil.amer) + Math.abs(profil.acide) + Math.abs(profil.fruite)) / 4
    * 10 / 3
  );
  const checkCurseur = (key) => {
    const val = reponses[key] ?? 5;
    const diff = Math.abs(val - intensiteRef);
    if (diff <= 2) return 10;
    if (diff <= 3) return 5;
    return 0;
  };
  score += checkCurseur('visuel_intensite');
  score += checkCurseur('nez_intensite');
  score += checkCurseur('bouche_intensite');
  score += checkCurseur('finish_intensite');
  score = Math.min(100, score);

  // Mention
  const mention = score >= 91 ? 'Nez de maître 🏆'
    : score >= 71 ? 'Palais affûté 🎯'
    : score >= 41 ? 'Bon détecteur 👃'
    : 'Palais en formation 🌱';

  // Ingrédients
  const ings = (r.ingredients || []).map(i => `${i.quantite || ''} ${i.unite || ''} ${i.nom}`.trim()).join('<br>');

  // Profil HTML avec comparaison
  const profilKeys = ['sucre','amer','acide','fruite','fume','floral','epice','cremeux'];
  const profilLabels = ['Sucré','Amer','Acide','Fruité','Fumé','Floral','Épicé','Crémeux'];
  const profilHTML = profilKeys.map((k, i) => {
    const val = profil[k] || 0;
    if (!val) return '';
    const pct = ((val + 3) / 6 * 100).toFixed(0);
    const ajuste = ajust[k] && ajust[k] !== 0;
    return `<div class="deg-profil-barre">
      <span style="width:60px;font-size:12px;color:var(--text-secondary);">${profilLabels[i]}${ajuste ? ' ✦' : ''}</span>
      <div class="deg-profil-track"><div class="deg-profil-fill" style="width:${pct}%"></div></div>
      <span style="font-size:12px;color:var(--text-muted);">${val > 0 ? '+' : ''}${val}</span>
    </div>`;
  }).join('');

  // Comparaison détectée
  const comparaisonHTML = `
    <div style="font-size:11px;font-weight:500;color:var(--text-muted);margin-bottom:8px;">CE QUE TU AS DÉTECTÉ</div>
    ${[
      {label:'👁 Visuel', choix: visuelChoix, intensite: reponses['visuel_intensite']},
      {label:'👃 Nez', choix: nezChoix, intensite: reponses['nez_intensite']},
      {label:'👄 Bouche', choix: boucheChoix, intensite: reponses['bouche_intensite']},
      {label:'✨ Finish', choix: finishChoix, intensite: reponses['finish_intensite']},
    ].map(e => `
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:0.5px solid var(--border);">
        <span style="color:var(--text-secondary);">${e.label}</span>
        <span style="color:var(--text-primary);">${e.choix || '—'} · ${e.intensite ?? 5}/10</span>
      </div>
    `).join('')}
  `;

  return `
    <div class="deg-revelation" style="text-align:center;margin-bottom:12px;">
      <div style="font-size:42px;font-weight:500;color:#c9a84c;">${score}</div>
      <div style="font-size:13px;color:var(--text-secondary);">/ 100</div>
      <div style="font-size:15px;font-weight:500;margin-top:4px;color:var(--text-primary);">${mention}</div>
      ${ajust && Object.values(ajust).some(v=>v!==0) ? '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">✦ profil ajusté pris en compte</div>' : ''}
    </div>
    <div class="deg-revelation">
      <h3>${r.nom}</h3>
      <div style="font-size:11px;font-weight:500;color:var(--text-muted);margin-bottom:6px;">INGRÉDIENTS</div>
      <div class="deg-ing-list">${ings || 'Non disponible'}</div>
    </div>
    <div class="deg-revelation">
      ${comparaisonHTML}
    </div>
    <div class="deg-revelation">
      <div style="font-size:11px;font-weight:500;color:var(--text-muted);margin-bottom:10px;">PROFIL RÉEL${ajust && Object.values(ajust).some(v=>v!==0) ? ' (ajusté)' : ''}</div>
      ${profilHTML || '<span style="font-size:13px;color:var(--text-muted);">Profil non renseigné</span>'}
    </div>
  `;
}
async function annulerService(serviceId, recetteId, portions) {
  if (!confirm('Annuler ce service et remettre les cl en cave ?')) return;

  const recette = recettes.find(r => r.id === recetteId);
  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;

  for (const ing of (recette?.ingredients || [])) {
    if (!ing.item_cave_id || !ing.quantite || ing.optionnel) continue;
    if (ing.unite !== 'cl' && ing.unite !== 'ml') continue;
    if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) continue;
    const qteCl = (ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite) * portions;
    const itemId = ing.item_cave_id;

    if (estEnVoyage) {
      const b = voyageBouteillesActives.find(b => b.item_cave_id === itemId);
      if (!b) continue;
      const nouveau = parseFloat(b.cl_restants_voyage ?? 0) + qteCl;
      await db.from('mode_voyage_bouteilles').update({ cl_restants_voyage: nouveau })
        .eq('item_cave_id', itemId).eq('mode_voyage_id', voyageActif.id);
      b.cl_restants_voyage = nouveau;
    } else {
      const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === itemId);
      if (!item) continue;
      const nouveau = (item.cl_restants ?? 0) + qteCl;
      await db.from('items').update({ cl_restants: nouveau }).eq('id', itemId).eq('user_id', currentUser.id);
      item.cl_restants = nouveau;
    }
  }

  await db.from('soiree_services').delete().eq('id', serviceId);
  await renderTableauBordSoiree();
}
