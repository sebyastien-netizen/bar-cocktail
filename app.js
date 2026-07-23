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
let ongletActif = 'cave';
 
// Section recettes
let sectionRecette  = 'cocktail';
let filtreBase      = '';
let filtreGout      = '';
let filtreDiff      = '';
let filtreDisponible = false;
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
 
function afficherApp() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
  chargerCave();
  chargerRecettes();
  chargerEquipements();
  chargerConcoctions();
  chargerDashboard();
  afficherOnglet('dashboard');
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
    if (tab === 'sessions') chargerSessions();
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
  container.innerHTML = '';
 
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
 
  const searchBar = document.createElement('div');
  searchBar.className = 'search-bar';
  searchBar.innerHTML = `
    <input type="text" id="search-input" placeholder="Rechercher un alcool ou ingrédient…" oninput="onSearch(this.value)" value="${filtreRecherche}">
    <button class="btn btn-outline" onclick="ouvrirModalAjout()">+ Ajouter</button>
  `;
  container.appendChild(searchBar);
 
  cave.categories.forEach(cat => {
    if (cat.id.startsWith('a-acheter')) return;
    if (filtreCategorieActive && cat.id !== filtreCategorieActive) return;
 
    const items = filtrerItems(cat.items);
    if (filtreRecherche && items.length === 0) return;
 
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
        ${items.map(item => renderItem(item, cat.id)).join('')}
      </div>
    `;
    container.appendChild(div);
  });
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
 
  return `
    <div class="item-cave ${!detenu ? 'item-non-detenu' : ''}" onclick="ouvrirModalItem('${item.id}', '${catId}')">
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
function onSearch(val) { filtreRecherche = val.toLowerCase(); renderCave(); }
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
 
function calculerDisponibilite(recette) {
  const caveIds = getItemsCave();
  const ingredientsRequis = (recette.ingredients || []).filter(i => !i.optionnel && i.item_cave_id);
  const manquants = ingredientsRequis.filter(i => !caveIds.has(i.item_cave_id));
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
  const [{ data: recs }, { data: ings }, { data: etapes }, { data: mats }] = await Promise.all([
    db.from('recettes').select('*, gout_sucre, gout_amer, gout_acide, gout_fruite, gout_fume, gout_floral, gout_epice, gout_cremeux, degustation_voir, degustation_sentir, degustation_gout, degustation_finish, degustation_defi, variante_alcool, variante_prestige, variante_mocktail_id, variante_notes, prix_portion, kit_portable, photo_url'),
    db.from('recette_ingredients').select('*').order('ordre'),
    db.from('recette_etapes').select('*').order('ordre'),
    db.from('recette_materiels').select('*')
  ]);
 
  recettes = (recs || []).map(r => ({
    ...r,
    ingredients: (ings || []).filter(i => i.recette_id === r.id),
    etapes:      (etapes || []).filter(e => e.recette_id === r.id),
    materiels:   (mats || []).filter(m => m.recette_id === r.id)
  }));
 
  renderRecettes();
}
 
function renderRecettes() {
  const container = document.getElementById('recettes-container');
  if (!container) return;
 
  let liste = recettes.filter(r => r.type === sectionRecette);
 
  if (filtreBase) liste = liste.filter(r => r.base_alcool === filtreBase);
  if (filtreGout) liste = liste.filter(r => r.gouts && r.gouts.includes(filtreGout));
  if (filtreDiff) liste = liste.filter(r => r.difficulte === filtreDiff);
 
  if (filtreDisponible) {
    liste = [...liste].sort((a, b) => calculerDisponibilite(a) - calculerDisponibilite(b));
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
        ✅ Réalisables en premier
      </button>
    </div>
 
    <div class="recettes-grille">
      ${liste.length === 0 ? '<div class="empty-state">Aucune recette trouvée.</div>' : ''}
      ${liste.map(r => renderCarteRecette(r)).join('')}
    </div>
  `;
}
 
// =============================================
// CARTE RECETTE — avec photo_url
// =============================================
 
function renderCarteRecette(r) {
  const nbManquants = calculerDisponibilite(r);
  const diffLabel   = { facile: 'Facile', moyen: 'Moyen', avance: 'Avancé' }[r.difficulte] || r.difficulte;
  const diffClass   = { facile: 'diff-facile', moyen: 'diff-moyen', avance: 'diff-avance' }[r.difficulte] || '';
 
  // Image ou fallback initiale
  const imgHtml = r.photo_url
    ? `<div class="carte-img-wrap">
        <img src="${r.photo_url}" alt="${r.nom}" class="carte-img" loading="lazy"
          onerror="this.parentElement.innerHTML='<span class=carte-img-initiale>${r.nom.charAt(0)}</span>'; this.parentElement.classList.add('carte-img--fallback')">
        <span class="carte-badge-dispo">${badgeDisponibilite(nbManquants)}</span>
       </div>`
    : `<div class="carte-img-wrap carte-img--fallback">
        <span class="carte-img-initiale">${r.nom.charAt(0)}</span>
        <span class="carte-badge-dispo">${badgeDisponibilite(nbManquants)}</span>
       </div>`;
 
  return `
    <div class="carte-recette" onclick="ouvrirFicheRecette('${r.id}')">
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
        </div>
      </div>
    </div>
  `;
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
    texte: `Maximum 2 cocktails par passe dans un shaker ou verre à mélange standard. Préparez en ${Math.ceil(p/2)} lots de 2. Commencez le second lot pendant que le premier est servi.`,
    bg: 'var(--bg-warning)', color: 'var(--text-warning)'
  };
  if (p <= 6) return {
    icon: '🍶', titre: `Pour ${p} verres — batch recommandé`,
    texte: `Mélangez tous les spiritueux à l'avance avec 20% d'eau pour simuler la dilution. Réfrigérez minimum 1h. Versez au service sur cube ou dans le shaker pour les cocktails citrus. Constant et rapide.`,
    bg: 'var(--bg-success)', color: 'var(--text-success)'
  };
  if (p <= 8) return {
    icon: '🍶', titre: `Pour ${p} verres — batch la veille`,
    texte: `Préparez le batch la veille avec 25% d'eau ajoutée. Le repos 12h unifie les arômes. Étiquetez la bouteille avec la date et le contenu. Sortez du frigo 5 min avant le service.`,
    bg: 'var(--bg-success)', color: 'var(--text-success)'
  };
  return {
    icon: '🎯', titre: `Pour ${p} verres — mode événement`,
    texte: `Batch obligatoire. Bouteille étiquetée au frigo. Verres au congélateur 10 min avant. Service : cube + ${Math.round(r.ingredients?.reduce((s,i) => s + (i.quantite||0), 0) * 1.25 * 10)/10}cl batch + garniture = 20 secondes par verre. Préparez les garnitures à l'avance.`,
    bg: 'rgba(83,74,183,0.1)', color: '#7F77DD'
  };
}

// =============================================
// CALCUL BATCH
// =============================================

function getBatchInfo(r, p) {
  if (p < 4) return null;
  const ratio = p >= 7 ? 0.25 : 0.20;
  const totalSpiritueux = (r.ingredients || [])
    .filter(i => i.quantite && i.unite === 'cl' && !i.optionnel)
    .reduce((s, i) => s + (i.quantite * p), 0);
  const eau = Math.round(totalSpiritueux * ratio * 10) / 10;
  const total = Math.round((totalSpiritueux + eau) * 10) / 10;
  return { totalSpiritueux: Math.round(totalSpiritueux * 10) / 10, eau, total, ratio: Math.round(ratio * 100) };
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
  if (!realisations.length) return `
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
      ${r.photo_url ? `<div class="fiche-img-wrap"><img src="${r.photo_url}" alt="${r.nom}" class="fiche-img" loading="lazy" onerror="this.parentElement.style.display='none'"></div>` : ''}
      <div class="fiche-entete-body">
        <div class="fiche-entete-top">
          <h2 class="fiche-titre">${r.nom}</h2>
          <div class="fiche-badges">
            <span class="carte-diff diff-${r.difficulte}">${diffLabel}</span>
            ${badgeDisponibilite(nbManquants)}
            ${r.kit_portable ? '<span class="tag-kit">✓ KIT</span>' : ''}
          </div>
        </div>
        ${r.base_alcool ? `<div class="fiche-base">🥃 ${r.base_alcool}</div>` : ''}
        <div class="fiche-gouts">${(r.gouts || []).map(g => `<span class="tag-gout">${g}</span>`).join('')}</div>
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

    <!-- GRILLE INFOS + SERVICE -->
    ${r.saveur_dominante || r.verre_type ? `
    <div class="fiche-grid-2">
      ${r.saveur_dominante ? `
      <div class="fiche-card">
        <div class="fiche-card-titre">Aperçu des caractéristiques</div>
        ${r.saveur_dominante ? `<div class="fiche-carac-row"><span>Saveur dominante</span><span>${r.saveur_dominante}</span></div>` : ''}
        ${r.aromes ? `<div class="fiche-carac-row"><span>Arômes</span><span>${r.aromes}</span></div>` : ''}
        ${r.arriere_gout ? `<div class="fiche-carac-row"><span>Arrière-goût</span><span>${r.arriere_gout}</span></div>` : ''}
        ${r.texture ? `<div class="fiche-carac-row"><span>Texture</span><span>${r.texture}</span></div>` : ''}
        ${r.couleur_robe ? `<div class="fiche-carac-row"><span>Couleur et robe</span><span>${r.couleur_robe}</span></div>` : ''}
        ${r.petillance ? `<div class="fiche-carac-row"><span>Pétillance</span><span>${r.petillance}</span></div>` : ''}
        ${r.sucrosite ? `<div class="fiche-carac-row"><span>Sucrosité</span><span>${r.sucrosite}</span></div>` : ''}
      </div>` : ''}
      ${r.verre_type ? `
      <div class="fiche-card">
        <div class="fiche-card-titre">Service</div>
        ${r.verre_type ? `<div class="fiche-carac-row"><span>Verre</span><span>${r.verre_type}</span></div>` : ''}
        ${r.glace_type ? `<div class="fiche-carac-row"><span>Glace</span><span>${r.glace_type}</span></div>` : ''}
        ${r.temperature_service ? `<div class="fiche-carac-row"><span>Température</span><span>${r.temperature_service}</span></div>` : ''}
        ${r.garniture ? `<div class="fiche-carac-row"><span>Garniture</span><span>${r.garniture}</span></div>` : ''}
        ${r.abv_estime ? `<div class="fiche-carac-row"><span>ABV estimé</span><span>${r.abv_estime}</span></div>` : ''}
        ${r.prix_portion ? `<div class="fiche-carac-row"><span>Prix / verre</span><span>~${r.prix_portion.toFixed(2)}€</span></div>` : ''}
        ${r.kit_portable ? `<div class="fiche-carac-row"><span>Kit portable</span><span>✓ Oui</span></div>` : ''}
      </div>` : ''}
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
          const enCave = ing.item_cave_id ? caveIds.has(ing.item_cave_id) : true;
          const qteBase = ing.cl_ajuste !== undefined ? ing.cl_ajuste : ing.quantite;
          const qte = qteBase ? Math.round(qteBase * portions * 10) / 10 : null;
          const qteModif = ing.cl_ajuste !== undefined && Math.abs((ing.cl_ajuste || 0) - (ing.quantite || 0)) > 0.05;
          const pct = ing.quantite && r.ingredients.reduce((s, i) => s + (i.quantite || 0), 0) > 0
            ? Math.round((ing.quantite / r.ingredients.reduce((s, i) => s + (i.quantite || 0), 0)) * 100)
            : 0;
          const couleur = !enCave ? 'danger' : (ing.optionnel ? 'success' : (qteModif ? 'warning' : 'accent'));
          return `
            <div class="fiche-ing-item">
              <div class="fiche-ing-icon fiche-ing-icon--${couleur}">
                <i class="ti ti-droplet" aria-hidden="true"></i>
              </div>
              <div class="fiche-ing-body">
                <div class="fiche-ing-header">
                  <span class="fiche-ing-nom ${!enCave && !ing.optionnel ? 'fiche-ing-nom--manquant' : ''}">${ing.nom}${ing.optionnel ? ' <span class="fiche-ing-opt">optionnel</span>' : ''}</span>
                  <span class="fiche-ing-qte">${qte ? qte + ' ' + (ing.unite || '') : ''}</span>
                </div>
                ${pct > 0 ? `<div class="fiche-ing-barre"><div class="fiche-ing-barre-fill fiche-ing-barre-fill--${couleur}" style="width:${pct}%"></div></div>` : ''}
                ${!enCave && !ing.optionnel ? `<div class="fiche-ing-warn">Manquant — voir À acheter</div>` : ''}
              </div>
            </div>`;
        }).join('')}
      </div>
      ${batch ? `
      <div class="fiche-batch-info">
        <strong>Batch :</strong> ${(r.ingredients || []).filter(i => i.quantite && i.unite === 'cl' && !i.optionnel).map(i => `${Math.round(i.quantite * portions * 10)/10}cl ${i.nom}`).join(' + ')} + ${batch.eau}cl eau = ${batch.total}cl total
      </div>` : ''}
    </div>

    <!-- MATÉRIELS -->
    ${r.materiels && r.materiels.length > 0 ? `
    <div class="fiche-card">
      <div class="fiche-card-titre">Matériels</div>
      <div class="fiche-materiels">
        ${r.materiels.map(m => `<span class="tag-materiel ${m.essentiel ? '' : 'materiel-optionnel'}">${m.nom}</span>`).join('')}
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

    <!-- OCCASIONS + INFOS -->
    ${r.occasions?.length || r.anecdote ? `
    <div class="fiche-grid-2">
      ${r.occasions?.length ? `
      <div class="fiche-card">
        <div class="fiche-card-titre">Occasions</div>
        <div class="fiche-occasions">${r.occasions.map(o => `<span class="fiche-occasion-chip">${o}</span>`).join('')}</div>
      </div>` : ''}
      <div class="fiche-card">
        <div class="fiche-card-titre">Infos</div>
        <div class="fiche-carac-row"><span>Sans gluten</span><span class="${r.sans_gluten !== false ? 'fiche-info-ok' : 'fiche-info-no'}">${r.sans_gluten !== false ? '✓ Oui' : '✗ Non'}</span></div>
        <div class="fiche-carac-row"><span>Vegan</span><span class="${r.vegan !== false ? 'fiche-info-ok' : 'fiche-info-no'}">${r.vegan !== false ? '✓ Oui' : '✗ Non'}</span></div>
        <div class="fiche-carac-row"><span>Sans lactose</span><span class="${r.sans_lactose !== false ? 'fiche-info-ok' : 'fiche-info-no'}">${r.sans_lactose !== false ? '✓ Oui' : '✗ Non'}</span></div>
        <div class="fiche-carac-row"><span>Sans œuf</span><span class="${r.sans_oeuf !== false ? 'fiche-info-ok' : 'fiche-info-no'}">${r.sans_oeuf !== false ? '✓ Oui' : '✗ Non'}</span></div>
        <div class="fiche-carac-row"><span>Kit portable</span><span class="${r.kit_portable ? 'fiche-info-ok' : 'fiche-info-no'}">${r.kit_portable ? '✓ Oui' : '✗ Non'}</span></div>
      </div>
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
  `;
}

function changerPortions(n) {
  if (n < 1 || n > 10) return;
  renderFiche(n);
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
  const pct = Math.round((valeur / 10) * 100);
  const couleur = valeur >= 7 ? 'var(--accent)' : valeur >= 4 ? 'var(--accent-light)' : 'var(--text-muted)';
  return `
    <div class="barre-row">
      <span class="barre-label">${label}</span>
      <div class="barre-track">
        <div class="barre-fill" style="width:${pct}%; background:${couleur}"></div>
      </div>
      <span class="barre-val">${valeur}/10</span>
    </div>
  `;
}
 
async function marquerRealisee(portions) {
  const r = recetteOuverte;
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
 
  fermerModal('modal-fiche-recette');
 
  const feedback = document.createElement('div');
  feedback.className = 'toast-feedback';
  feedback.textContent = updates.length > 0
    ? `✓ Cave mise à jour (${updates.length} bouteille${updates.length > 1 ? 's' : ''} décrémentée${updates.length > 1 ? 's' : ''})`
    : '✓ Recette marquée comme réalisée';
  document.body.appendChild(feedback);
  setTimeout(() => feedback.classList.add('visible'), 50);
  setTimeout(() => { feedback.classList.remove('visible'); setTimeout(() => feedback.remove(), 300); }, 2500);
 
  renderCave();
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
    const cl_total    = parseInt(document.getElementById('input-cl-total')?.value)    || null;
    const cl_restants = parseFloat(document.getElementById('input-cl-restants')?.value) || null;
    const updates = { cl_total, cl_restants };
    await db.from('items').update(updates).eq('id', itemId).eq('user_id', currentUser.id);
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
    if (!error && data) {
      const cat = cave.categories.find(c => c.id === catId);
      if (cat) cat.items.push(data);
    }
 
    fermerModal('modal-ajout');
    renderCave();
  };
 
  afficherModal('modal-ajout');
}
 
function onTabChange(tab) {
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
 
function afficherModal(id) { document.getElementById(id).classList.add('visible'); }
function fermerModal(id)   { document.getElementById(id).classList.remove('visible'); }
 
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
                ${e.date_etape ? '<div class="etape-date">' + formatDate(e.date_etape) + (joursEtape !== null && e === prochaineEtape ? ' <span class="etape-jours' + (joursEtape <= 3 ? ' jours-urgent' : '') + '">(' + (joursEtape > 0 ? 'dans ' + joursEtape + 'j' : "aujourd'hui !") + ')</span>' : '') + '</div>' : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
 
      ${c.notes ? `<div class="conc-notes">💡 ${c.notes}</div>` : ''}
 
      <div class="conc-actions">
        ${c.statut === 'en_cours' ? `<button class="btn btn-outline btn-sm" onclick="marquerPret('${c.id}')">✅ Marquer prêt</button>` : ''}
        ${c.statut === 'pret' ? `<button class="btn btn-outline btn-sm" onclick="marquerEnCours('${c.id}')">↩ Remettre en cours</button>` : ''}
        <button class="btn-icon btn-supprimer" onclick="supprimerConcoction('${c.id}')" title="Supprimer définitivement">🗑</button>
      </div>
    </div>
  `;
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
 
async function supprimerConcoction(concId) {
  const conc = concoctions.find(c => c.id === concId);
  if (!confirm(`Supprimer définitivement "${conc?.nom}" ? Cette action est irréversible.`)) return;
  await db.from('concoctions').delete().eq('id', concId).eq('user_id', currentUser.id);
  concoctions = concoctions.filter(c => c.id !== concId);
  renderConcoctions();
}
 
function ouvrirModalAjoutConcoction() {
  const modal = document.getElementById('modal-ajout-concoction');
  if (!modal) return;
  modal.querySelector('#input-conc-nom').value = '';
  modal.querySelector('#input-conc-type').value = 'batch';
  modal.querySelector('#input-conc-desc').value = '';
  modal.querySelector('#input-conc-date').value = new Date().toISOString().split('T')[0];
  modal.querySelector('#input-conc-notes').value = '';
 
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
      date_creation: date, statut: 'en_cours', notes
    }).select().single();
 
    if (data) concoctions.unshift({ ...data, etapes: [] });
    fermerModal('modal-ajout-concoction');
    renderConcoctions();
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

async function chargerAAcheter() {
  const container = document.getElementById('aacheter-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Calcul en cours…</div>';

  // IDs des items détenus en cave
  const caveIds = getItemsCave();

  const { data: allItems } = await db.from('items').select('id, nom, prix_estime, detenu, category_id').eq('user_id', currentUser.id);

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

  container.innerHTML = `

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
      <div id="analyser-result"></div>
    </div>
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
          ${items.map(item => renderItemAAcheter(item, false)).join('')}
        </div>
      `;
    }).join('')}
<!-- SIMULATEUR -->
    <div class="aacheter-groupe">
      <div class="aacheter-groupe-titre">🔮 Simulateur — et si j'avais…</div>
      <select id="simulateur-select" onchange="simulerGain(this.value)" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:var(--bg-card);color:var(--text-primary);font-size:14px;margin-bottom:12px;">
        <option value="">Choisir un alcool manquant…</option>
        ${allScored.map(i => `<option value="${i.id}">${i.nom}${i.prix ? ' — ' + i.prix + '€' : ''}</option>`).join('')}
      </select>
      <div id="simulateur-result"></div>
    </div>
   
    <!-- APPORT GUSTATIF -->
    <div class="aacheter-groupe">
      <button class="btn btn-outline btn-apport" id="btn-apport-gustatif" onclick="chargerApportGustatif()">
        ✨ Analyser l'apport gustatif (Claude)
      </button>
      <div id="apport-gustatif-result"></div>
    </div>
  `;
}
async function analyserBouteille() {
  const nom = document.getElementById('analyser-input')?.value?.trim();
  if (!nom) return;

  const btn = document.getElementById('analyser-btn');
  const result = document.getElementById('analyser-result');
  btn.disabled = true;
  btn.textContent = 'Analyse en cours…';
  result.innerHTML = '<div class="simulateur-vide">Interrogation du bartender IA…</div>';

  // Préparer la liste cave pour le contexte
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
      btn.disabled = false;
      btn.textContent = '🔍 Analyser';
      return;
    }

    // Calcul recettes débloquées via simulation
    const caveIds = getItemsCave();
    // On cherche un item_cave_id correspondant au nom soumis
    const itemMatch = (cave?.categories || [])
      .flatMap(c => c.items)
      .find(i => i.nom.toLowerCase().includes(nom.toLowerCase()) && i.detenu === false);

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
              <div class="simulateur-recette" onclick="ouvrirFiche('${r.id}')">
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

    result.innerHTML = `
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

        <div class="analyser-verdict ${verdictClass}">${data.verdict_raison}</div>

        ${itemMatch ? `<button class="btn btn-outline" style="margin-top:12px;width:100%" onclick="ajouterAListe('${itemMatch.id}')">+ Ajouter à ma liste d'achats</button>` : ''}
      </div>
    `;

  } catch (e) {
    result.innerHTML = '<div class="simulateur-vide">Erreur de connexion. Réessaie.</div>';
  }

  btn.disabled = false;
  btn.textContent = '🔍 Analyser';
}

async function ajouterAListe(itemId) {
  // Marquer l'item comme "à acheter" — reste detenu:false mais on le met en evidence
  alert('Fonctionnalité à venir — pour l\'instant ajoute-le depuis Ma Cave.');
}
function simulerGain(itemId) {
  const result = document.getElementById('simulateur-result');
  if (!itemId) { result.innerHTML = ''; return; }
  const caveIds = getItemsCave();
  const simulCave = new Set([...caveIds, itemId]);
  const debloquees = recettes.filter(r => {
    const manquantsAvant = (r.ingredients || []).filter(i =>
      i.item_cave_id && !caveIds.has(i.item_cave_id) && !i.optionnel
    ).length;
    const manquantsApres = (r.ingredients || []).filter(i =>
      i.item_cave_id && !simulCave.has(i.item_cave_id) && !i.optionnel
    ).length;
    return manquantsAvant > 0 && manquantsApres === 0;
  });
  if (!debloquees.length) {
    result.innerHTML = '<div class="simulateur-vide">Aucune recette supplémentaire débloquée.</div>';
    return;
  }
  result.innerHTML = `
    <div class="simulateur-gain">
      <div class="simulateur-gain-titre">+${debloquees.length} recette${debloquees.length > 1 ? 's' : ''} débloquée${debloquees.length > 1 ? 's' : ''}</div>
      ${debloquees.map(r => `
        <div class="simulateur-recette" onclick="ouvrirFiche('${r.id}')">
          <span class="simulateur-recette-nom">${r.nom}</span>
          <span class="simulateur-recette-gouts">${(r.gouts || []).join(', ')}</span>
        </div>
      `).join('')}
    </div>
  `;
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
          ${colorant ? '<span class="aacheter-colorant-badge">🎨</span>' : ''}
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
            ${r.nom}
            <span class="aacheter-chip-diff diff-${r.difficulte}">${{facile:'F',moyen:'M',avance:'A'}[r.difficulte]||''}</span>
          </span>
        `).join('')}
        ${item.recettesDetail.length > 4 ? `<span class="aacheter-chip-more">+${item.recettesDetail.length - 4}</span>` : ''}
      </div>
    </div>
  `;
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
 
function renderDashboard({ realisables, prixTotal, conservations, concEnCours, anecdote, conseil }) {
  const container = document.getElementById('dashboard-container');
  const categorieLabel = { technique: 'Technique', gestion: 'Gestion', service: 'Service' };
  const categorieClass = { technique: 'badge-3', gestion: 'badge-ok', service: 'badge-1' };
 
  const nbConservations = conservations.length;
  const nbConcoctions   = concEnCours.length;
const nbRefs = (cave?.categories || []).reduce((n, c) => n + c.items.filter(i => i.detenu !== false).length, 0); 
  container.innerHTML = `
 
    <!-- TUILES STATISTIQUES -->
    <div class="dashboard-grid-top">
      <div class="dash-stat">
        <span class="dash-stat-label">Réalisables maintenant</span>
        <span class="dash-stat-val dash-val-accent">${realisables.length}</span>
        <span class="dash-stat-sub">sur ${recettes.filter(r => r.type === 'cocktail').length} cocktails</span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-label">Valeur cave</span>
        <span class="dash-stat-val">${prixTotal.toFixed(0)} €</span>
        <span class="dash-stat-sub">${nbRefs} références</span>
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
      <div class="dash-stat">
        <span class="dash-stat-label">Conservations</span>
        <span class="dash-stat-val ${nbConservations > 0 ? 'dash-val-danger' : ''}">${nbConservations}</span>
        <span class="dash-stat-sub">${nbConservations > 0 ? 'à surveiller' : 'tout est bon'}</span>
      </div>
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
  `;
}
 
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
let plantesList = [];
let filtreHerboFamille = '';
let filtreHerboUsage = '';
let plantesOuverte = null;
 
// =============================================
// CHARGEMENT
// =============================================
 
async function chargerHerboristerie() {
  const container = document.getElementById('herboristerie-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Chargement…</div>';
 
  const { data: plantes } = await db.from('plantes').select('*').order('nom');
  if (!plantes) return;
 
  plantesList = plantes;
  renderHerboristerie(plantes);
}
 
// =============================================
// RENDU LISTE
// =============================================
 
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
  `;
 
  afficherModal('modal-fiche-plante');
}

let ecoleData = { alcools: [], techniques: [], materiels: [], lexique: [] };
let ecoleSection = 'alcools';
 
// =============================================
// CHARGEMENT
// =============================================
 
async function chargerEcole() {
  const container = document.getElementById('ecole-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Chargement…</div>';
 
  const [{ data: alcools }, { data: techniques }, { data: materiels }, { data: lexique }] = await Promise.all([
    db.from('ecole_alcools').select('*').order('ordre'),
    db.from('ecole_techniques').select('*').order('ordre'),
    db.from('ecole_materiels').select('*').order('ordre'),
    db.from('ecole_lexique').select('*').order('ordre')
  ]);
 
  ecoleData = {
    alcools:    alcools    || [],
    techniques: techniques || [],
    materiels:  materiels  || [],
    lexique:    lexique    || []
  };
 
  renderEcole();
}
 
// =============================================
// RENDU PRINCIPAL
// =============================================
 
function renderEcole() {
  const container = document.getElementById('ecole-container');
  if (!container) return;
 
  const sections = [
    { id: 'alcools',    label: '🥃 Alcools' },
    { id: 'techniques', label: '🍹 Techniques' },
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
            <span class="ecole-emoji" style="font-size:1.2rem">${m.emoji}</span>
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
}
 
function ouvrirFicheMateriel(id) {
  const m = ecoleData.materiels.find(x => x.id === id);
  if (!m) return;
 
  document.querySelector('.ecole-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2.5rem">${m.emoji}</span>
      <div><h2 class="fiche-titre">${m.nom}</h2></div>
    </div>
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

function ouvrirModalNotes(recette, date, callback) {
  const modal = document.getElementById('modal-realisation');
  document.getElementById('real-cocktail-nom').textContent = recette.nom;
  let etoilesVal = 0;
  const etoiles = modal.querySelectorAll('.etoile');
  etoiles.forEach(e => e.classList.remove('active'));
  etoiles.forEach(e => {
    e.onclick = () => {
      etoilesVal = parseInt(e.dataset.val);
      etoiles.forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= etoilesVal));
    };
  });
  modal.querySelector('#real-plus').value = '';
  modal.querySelector('#real-moins').value = '';
  modal.querySelector('#real-note').value = '';
  modal.querySelector('#real-photo').value = '';
  modal.querySelector('#real-photo-preview').innerHTML = '';
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
  modal.querySelector('#btn-confirmer-realisation').onclick = async () => {
    const plus = modal.querySelector('#real-plus').value.trim();
    const moins = modal.querySelector('#real-moins').value.trim();
    const noteLib = modal.querySelector('#real-note').value.trim();
    const photoFile = modal.querySelector('#real-photo').files[0];
    const noteObj = {};
    if (etoilesVal) noteObj.etoiles = etoilesVal;
    if (plus) noteObj.plus = plus;
    if (moins) noteObj.moins = moins;
    if (noteLib) noteObj.note = noteLib;
    let photoUrl = null;
    if (photoFile) {
      const ext = photoFile.name.split('.').pop();
      const path = `realisations/${currentUser.id}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await db.storage
        .from('photos-realisations')
        .upload(path, photoFile, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = db.storage.from('photos-realisations').getPublicUrl(path);
        photoUrl = urlData?.publicUrl || null;
      }
    }
    fermerModal('modal-realisation');
    if (callback) callback(noteObj, photoUrl);
  };
  afficherModal('modal-realisation');
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
