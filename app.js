// =============================================
// BAR APP — Logique principale avec Supabase
// =============================================
 
const SUPABASE_URL  = 'https://wqsprjlocuhandhvpytx.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_g4pDtkemUi-6VUG6qgVJWw_PAy5YibN';
 
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
 
let cave        = null;
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
 
function calculerDisponibilite(recette, caveIdsOverride) {
  const caveIds = caveIdsOverride || getItemsCave();
  const ingredientsRequis = (recette.ingredients || []).filter(i => !i.optionnel && i.item_cave_id);
  const manquants = ingredientsRequis.filter(i => !caveIds.has(i.item_cave_id));
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
    return !voyageBouteillesActives.some(b => b.item_cave_id === i.item_cave_id);
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

        const recommandations = caveItems.filter(i => i.sous_type_alcool === info.sous_type_alcool);

        let recoHtml = '';
        if (recommandations.length > 0) {
          recoHtml = `<div style="margin-top:6px;">Vous avez déjà : ${recommandations.map(r => `<strong>${r.nom}</strong>`).join(', ')}</div>`;
        }

        resultDiv.innerHTML = `🏷️ ${info.categorie_id} — style : ${info.sous_type_alcool || 'non déterminé'}${info.tourbe ? ' (tourbé)' : ''}${recoHtml}`;

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
    if (voyageActif) {
      liste = liste.filter(r => calculerDisponibiliteVoyage(r) === 0);
      liste = [...liste].sort((a, b) => calculerDisponibiliteVoyage(a) - calculerDisponibiliteVoyage(b));
    } else {
      liste = [...liste].sort((a, b) => calculerDisponibilite(a) - calculerDisponibilite(b));
    }
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
  ${voyageActif ? '🧳 Réalisables voyage' : '✅ Réalisables en premier'}
</button>
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
    const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === ing.item_cave_id);
    if (!item || item.cl_restants === null || item.cl_restants === undefined) {
      inconnu = true;
      return;
    }
    const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
    if (qteCl <= 0) return;
    const disponibleReel = Math.max(0, item.cl_restants - clReserveePour(item.id));
    const possibles = Math.floor(disponibleReel / qteCl);
    if (possibles < max) max = possibles;
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
    const bouteille = voyageBouteillesActives.find(b => b.item_cave_id === ing.item_cave_id);
    if (!bouteille || bouteille.cl_restants_voyage === null) { horsVoyage = true; return; }
    const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
    if (qteCl <= 0) return;
    const possibles = Math.floor(bouteille.cl_restants_voyage / qteCl);
    if (possibles < max) max = possibles;
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
      ${(bouteilles || []).map(b => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.88rem">
          <span>${b.nom}</span>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="color:var(--text-accent)">${b.cl_restants_voyage ?? '—'} cl</span>
            <button class="btn-icon" style="color:var(--text-danger)" onclick="retirerBouteilleVoyage('${b.id}')">🗑</button>
          </div>
        </div>
      `).join('') || '<div style="font-size:0.8rem;color:var(--text-muted)">Aucune bouteille.</div>'}
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

// Ouvre le sélecteur d'ingrédients à prioriser
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
${enCave === null && !ing.optionnel ? `
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

  if (!ingsCorrespondants || ingsCorrespondants.length === 0) return;

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
      const { data: itemArchive } = await db.from('items').insert({
        user_id: currentUser.id,
        nom: conc.nom,
        category_id: 'concoctions',
        detenu: true,
        info_description: notes || `Concoction maison archivée le ${new Date().toLocaleDateString('fr-FR')}.`
      }).select().single();
      if (itemArchive) await autoLierIngredientParNom(itemArchive.nom, itemArchive.id);
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
async function analyserBouteille() {
  const nom = document.getElementById('analyser-input')?.value?.trim();
  if (!nom) return;

  const btn = document.getElementById('analyser-btn');
  const result = document.getElementById('analyser-result');
  btn.disabled = true;
  btn.textContent = 'Analyse en cours…';
  result.innerHTML = '<div class="simulateur-vide">Interrogation du bartender IA…</div>';

  const caveListe = (cave?.categories || [])
    .flatMap(c => c.items)
    .filter(i => i.detenu !== false)
    .map(i => i.nom)
    .join(', ');

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
      result.innerHTML = construireResultatAnalyse(data, nom);
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

  const caveListe = (cave?.categories || [])
    .flatMap(c => c.items)
    .filter(i => i.detenu !== false)
    .map(i => i.nom)
    .join(', ');

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
        <div class="analyser-label">🍹 Cocktails réalisables</div>
        ${data.cocktails_possibles.map(c => `
          <div class="simulateur-recette">
            <span class="simulateur-recette-nom">${c.nom}</span>
            <span class="simulateur-recette-gouts">${
              c.ingredients_manquants?.length
                ? '⚠️ manque : ' + c.ingredients_manquants.join(', ')
                : '✓ réalisable maintenant'
            }</span>
          </div>`).join('')}
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
        onclick="this.closest('div[style*=fixed]').remove(); creerSoireeMenuSolo()">
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

modal.innerHTML = `
    <div style="max-width:600px;margin:0 auto;background:var(--bg-card);border-radius:16px;padding:20px">
      <div style="font-size:1.1rem;font-weight:700;color:var(--accent);margin-bottom:4px">🏁 Bilan du voyage — ${voyageActif.nom}</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:16px">Vérifie et ajuste les quantités consommées avant d'appliquer à ta cave.</div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
        <button class="btn-primary" style="width:100%;padding:12px" 
          onclick="appliquerBilanVoyage(${JSON.stringify(lignes.map((l, idx) => ({ itemId: l.b.item_cave_id, idx })))})">
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
}
