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
            ${r.source_marque ? `<span style="background:var(--bg-accent);color:var(--text-accent);border:1px solid var(--border-accent);border-radius:20px;font-size:0.72rem;padding:3px 8px;">🏷️ ${r.source_marque}</span>` : ''}
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

    <!-- ACTION SUPPRIMER -->
    <div class="fiche-action" style="margin-top:10px">
      <button class="btn-danger" style="width:100%" onclick="supprimerRecette('${r.id}')">
        🗑️ Supprimer cette recette
      </button>
    </div>
  `;
}

function changerPortions(n) {
  if (n < 1 || n > 10) return;
  renderFiche(n);
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
 
let modalHistoryOuvert = false;

function afficherModal(id) {
  document.getElementById(id).classList.add('visible');
  if (!modalHistoryOuvert) {
    modalHistoryOuvert = true;
    history.pushState({ modalOuvert: true }, '', location.href);
  }
}

function fermerModal(id) {
  document.getElementById(id).classList.remove('visible');
  const encoreUnModalOuvert = document.querySelector('.modal-overlay.visible');
  if (modalHistoryOuvert && !encoreUnModalOuvert) {
    modalHistoryOuvert = false;
    history.back();
  }
}

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
      await db.from('items').insert({
        user_id: currentUser.id,
        nom: conc.nom,
        category_id: 'concoctions',
        detenu: true,
        info_description: notes || `Concoction maison archivée le ${new Date().toLocaleDateString('fr-FR')}.`
      });
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

const { data: sessions } = await db.from('sessions_invites')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('is_master', true)
    .order('created_at', { ascending: false });

  renderSessions(sessions || []);
}

function renderSessions(sessions) {
  const container = document.getElementById('sessions-container');
  const actives = sessions.filter(s => new Date(s.expires_at) > new Date());
  const passees = sessions.filter(s => new Date(s.expires_at) <= new Date());

  container.innerHTML = `
    <div class="cave-header">
      <h2>🎉 Sessions cocktail</h2>
      <div style="display:flex;gap:8px">
        ${passees.length > 0 ? `<button class="btn-outline" onclick="supprimerSessionsPassees()">🗑️ Vider les passées (${passees.length})</button>` : ''}
        <button class="btn-primary" onclick="ouvrirModalNouvelleSession()">+ Nouvelle session</button>
      </div>
    </div>

    ${actives.length > 0 ? `
    <div class="section-label">EN COURS</div>
    ${actives.map(s => renderCarteSession(s)).join('')}
    ` : `
    <div class="empty-state">
      <p>Aucune session active</p>
      <button class="btn-primary" onclick="ouvrirModalNouvelleSession()">Lancer une soirée</button>
    </div>
    `}

    ${passees.length > 0 ? `
    <div class="section-label" style="margin-top:1.5rem">PASSÉES</div>
    ${passees.slice(0, 5).map(s => renderCarteSession(s, true)).join('')}
    ` : ''}
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
        <span style="font-weight:600;font-size:1rem">${s.nom_session || 'Session sans nom'}</span>
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

function setModeSession(mode) {
  modeSessionActif = mode;
  document.getElementById('btn-mode-libre').classList.toggle('active', mode === 'libre');
  document.getElementById('btn-mode-verrouille').classList.toggle('active', mode === 'verrouille');
}

function ouvrirModalNouvelleSession() {
  modeSessionActif = 'libre';
  document.getElementById('session-nom').value = '';
  document.getElementById('btn-mode-libre').classList.add('active');
  document.getElementById('btn-mode-verrouille').classList.remove('active');

  // Liste recettes réalisables
  const realisables = recettes.filter(r => r.type === 'cocktail' && calculerDisponibilite(r) === 0);
  const liste = document.getElementById('session-recettes-liste');
  liste.innerHTML = realisables.map(r => `
    <div class="session-recette-item" onclick="this.querySelector('input').click()">
      <input type="checkbox" value="${r.id}" checked />
      <div>
        <div class="session-recette-item-nom">${r.nom}</div>
        <div class="session-recette-item-meta">${r.base_alcool || ''} · ${(r.gouts || []).slice(0,2).join(' · ')}</div>
      </div>
    </div>
  `).join('');
  document.getElementById('modal-nouvelle-session').classList.add('visible');
} 
async function creerSession() {
  const nom = document.getElementById('session-nom').value.trim() || 'Session sans nom';
  const checks = document.querySelectorAll('#session-recettes-liste input[type=checkbox]:checked');
  const recettesDisponibles = Array.from(checks).map(c => c.value);

  const token = Math.random().toString(36).substring(2, 10);
  const expiresAt = new Date(Date.now() + 3 * 3600 * 1000).toISOString();

 const { error } = await db.from('sessions_invites').insert({
    user_id: currentUser.id,
    token,
    nom_session: nom,
    mode_choix: modeSessionActif,
    recettes_disponibles: recettesDisponibles,
    expires_at: expiresAt,
    is_master: true
  });

  if (error) { alert('Erreur création session : ' + error.message); return; }

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
      <div style="font-size:1.2rem;font-weight:600;margin-bottom:4px">${session.nom_session || 'Session sans nom'}</div>
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

function renderInvitesListe(invites, session) {
  const liste = document.getElementById('session-invites-liste');
  if (!liste) return;

  if (invites.length === 0) {
    liste.innerHTML = '<div style="font-size:0.85rem;opacity:0.4;text-align:center;padding:1rem">En attente d\'invités…</div>';
    return;
  }

  liste.innerHTML = invites.map(inv => {
    const profil = inv.profil_gustatif || {};
    const axes = Object.entries(profil).filter(([k, v]) => v > 0).map(([k, v]) => k).join(' · ') || '—';
    const recette = inv.recette_id ? recettes.find(r => r.id === inv.recette_id)?.nom || inv.recette_id : '—';

    return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-weight:600">${inv.nom_invite || 'Invité'}</div>
          <span style="font-size:0.75rem;opacity:0.5">${inv.choix_type === 'seb' ? '✨ Laisse Seb choisir' : '🍸 A choisi'}</span>
        </div>
        <div style="font-size:0.78rem;opacity:0.5;margin-bottom:8px">Profil : ${axes}</div>
        <div style="font-size:0.82rem;margin-bottom:10px">Cocktail : <strong>${recette}</strong></div>
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

function rafraichirInvite(data) {
  const liste = document.getElementById('session-invites-liste');
  if (!liste) return;

  const profil = data.profil_gustatif || {};
  const axes = Object.entries(profil).filter(([k, v]) => v > 0).map(([k, v]) => k).join(' · ') || '—';
  const recette = data.recette_id
    ? recettes.find(r => r.id === data.recette_id)?.nom || data.recette_id
    : null;

  liste.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-weight:600">${data.nom_invite || 'Invité'}</div>
        <span style="font-size:0.75rem;background:var(--bg-card);border:1px solid var(--border);border-radius:20px;padding:2px 10px">
          ${data.choix_type === 'seb' ? '✨ Laisse Seb choisir' : '🍸 A choisi'}
        </span>
      </div>
      <div style="font-size:0.78rem;opacity:0.5;margin-bottom:10px">Profil : ${axes}</div>
      ${recette ? `<div style="font-size:0.85rem;margin-bottom:10px">Demande : <strong>${recette}</strong></div>` : ''}
      <button class="btn-primary" style="width:100%;font-size:0.85rem" 
        onclick="allerVersRecette('${data.recette_id || sessionActive?.recettes_disponibles?.[0]}')">
        → Préparer
      </button>
    </div>
  `;
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

async function chargerInspirations() {
  const container = document.getElementById('inspirations-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Chargement…</div>';
  const { data } = await db.from('inspirations').select('*').order('created_at', { ascending: false });
  inspirationsList = data || [];
  renderInspirations();
}

function renderInspirations() {
  const container = document.getElementById('inspirations-container');
  if (!container) return;

  const enAttente = inspirationsList.filter(i => i.statut === 'en_attente');
  const validees = inspirationsList.filter(i => i.statut === 'validee');
  const rejetees = inspirationsList.filter(i => i.statut === 'rejetee');

  container.innerHTML = `
<div style="padding:1rem;display:flex;justify-content:flex-end;gap:8px">
<button class="btn-outline" onclick="captureRapideBartender()">📱 Dévoile ton cocktail</button>
<button class="btn-outline" onclick="ouvrirLaTournee()">🍹 La Tournée</button>
      <button class="btn-primary" onclick="afficherModal('modal-ajout-inspiration')">+ Ajouter</button>
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
      <h3 class="conc-section-titre">❌ Rejetées (${rejetees.length})</h3>
      <div class="herbo-grille">
        ${rejetees.map(i => renderCarteInspiration(i)).join('')}
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
function renderCarteInspiration(inspi) {
  const ings = Array.isArray(inspi.ingredients) ? inspi.ingredients : [];
  const tags = inspi.tags || [];
  const dateStr = new Date(inspi.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const sourceIcon = { manuel: '✍️', photo: '📷', url: '🔗' };

  return `
    <div class="herbo-carte" onclick="ouvrirFicheInspiration('${inspi.id}')">
      ${inspi.photo_url ? `<img src="${inspi.photo_url}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:8px">` : ''}
      <div class="herbo-carte-top">
        <span class="herbo-emoji">${sourceIcon[inspi.source] || '💡'}</span>
        <div class="herbo-carte-info">
          <div class="herbo-nom">${inspi.nom}</div>
          ${inspi.source_detail ? `<div class="herbo-latin">${inspi.source_detail}</div>` : ''}
        </div>
        <span class="herbo-saison ${inspi.statut === 'en_attente' ? 'herbo-saison--off' : inspi.statut === 'validee' ? 'herbo-saison--ok' : ''}">
          ${inspi.statut === 'en_attente' ? '⏳' : inspi.statut === 'validee' ? '✅' : '❌'}
        </span>
      </div>
      ${ings.length > 0 ? `
      <div class="herbo-profil" style="margin-top:6px">
        ${ings.slice(0, 3).map(ing => typeof ing === 'string' ? ing : ing.nom).join(' · ')}${ings.length > 3 ? ` +${ings.length - 3}` : ''}
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

async function sauverInspiration() {
  const nom = document.getElementById('inspi-nom').value.trim();
  if (!nom) return;

  const ingsRaw = document.getElementById('inspi-ingredients').value.trim();
  const ingredients = ingsRaw ? ingsRaw.split('\n').filter(Boolean).map(l => ({ nom: l.trim() })) : [];
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
    document.getElementById('inspi-ingredients').value = '';
    document.getElementById('inspi-tags').value = '';
    document.getElementById('inspi-notes').value = '';
    document.getElementById('inspi-source-detail').value = '';
    renderInspirations();
  }
}

async function ouvrirFicheInspiration(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;

  const ings = Array.isArray(inspi.ingredients) ? inspi.ingredients : [];
  const tags = inspi.tags || [];
  const dateStr = new Date(inspi.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const sourceLabel = { manuel: 'Saisie manuelle', photo: 'Photo', url: 'URL' };

  const { data: reponsesBartender } = await db.from('bartender_reponses').select('*').eq('inspiration_id', id).order('created_at', { ascending: false });

  document.getElementById('inspiration-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2rem">💡</span>
      <div>
        <h2 class="fiche-titre">${inspi.nom}</h2>
        <div class="herbo-latin">${sourceLabel[inspi.source] || ''} ${inspi.source_detail ? '· ' + inspi.source_detail : ''} · ${dateStr}</div>
      </div>
    </div>

    ${inspi.photo_url ? `<img src="${inspi.photo_url}" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px;margin-bottom:16px">` : ''}

    ${(reponsesBartender && reponsesBartender.length > 0) ? `
    <div class="plante-section">
      <h3>📱 Réponses bartender (${reponsesBartender.length})</h3>
      ${reponsesBartender.map(r => renderReponseBartender(r)).join('')}
    </div>` : ''}

    ${ings.length > 0 ? `
    <div class="plante-section">
      <h3>Ingrédients</h3>
      ${ings.map(ing => `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.9rem">${typeof ing === 'string' ? ing : ing.nom}</div>`).join('')}
    </div>` : ''}

${(() => {
  if (!inspi.notes) return '';
  let notes = inspi.notes;
  try { notes = JSON.parse(inspi.notes); } catch(e) { return `<div class="plante-section"><h3>Notes</h3><p>${inspi.notes}</p></div>`; }
  if (typeof notes !== 'object') return `<div class="plante-section"><h3>Notes</h3><p>${inspi.notes}</p></div>`;
  const lignes = [];
  if (notes.prenom) lignes.push(`<div style="font-size:0.85rem">👤 Partagé par <strong>${notes.prenom}</strong></div>`);
  if (notes.type) lignes.push(`<div style="font-size:0.85rem">📌 Type : <strong>${notes.type === 'cocktail' ? 'Cocktail' : 'Concoction/Recette'}</strong></div>`);
  if (notes.origine) lignes.push(`<div style="font-size:0.85rem;font-style:italic;color:var(--text-secondary)">💬 "${notes.origine}"</div>`);
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
      <button class="btn-outline" onclick="ouvrirCompleterDepuisFiche('${inspi.id}')">✨ Compléter et valider</button>
      <button class="btn-outline" onclick="ouvrirQRDepuisFiche('${inspi.id}')">📱 Dévoile ton cocktail</button>
      <button class="btn-outline" onclick="rejeterInspiration('${inspi.id}')">❌ Rejeter</button>` : ''}
      ${inspi.statut === 'validee' ? `<div style="color:var(--text-success);font-size:0.85rem;text-align:center">✅ Déjà validée</div>` : ''}
    </div>
  `;

  afficherModal('modal-fiche-inspiration');
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

async function validerInspiration(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;

  // Créer la recette dans la table recettes
 // Vérifier si une recette liée existe déjà
if (inspi.recette_liee_id) {
  alert('Cette inspiration a déjà été validée — recette existante dans l\'onglet Recettes.');
  return;
}
  const recetteId = 'inspi-' + Date.now();
  const ings = Array.isArray(inspi.ingredients) ? inspi.ingredients : [];

  const { data: recette } = await db.from('recettes').insert({
    id: recetteId,
    user_id: currentUser.id,
    type: 'cocktail',
    nom: inspi.nom,
    difficulte: 'moyen',
    description_courte: inspi.notes || null,
    photo_url: inspi.photo_url || null
  }).select().single();

  if (recette && ings.length > 0) {
    // Insérer les ingrédients
    const ingredientsAInserer = ings.map((ing, i) => ({
      recette_id: recetteId,
      user_id: currentUser.id,
      nom: typeof ing === 'string' ? ing : ing.nom,
      quantite: ing.quantite || null,
      unite: ing.unite || null,
      ordre: i + 1
    }));
    await db.from('recette_ingredients').insert(ingredientsAInserer);
  }

  // Mettre à jour l'inspiration
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
  // Recharger les recettes pour inclure la nouvelle
  await chargerRecettes();
  alert(`✅ "${inspi.nom}" ajoutée aux recettes. Complétez les détails depuis l'onglet Recettes.`);
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

  const { data: recette } = await db.from('recettes').insert({
    id: recetteId,
    user_id: currentUser.id,
    type: 'cocktail',
    nom: inspi.nom,
    difficulte: result.difficulte || 'moyen',
    base_alcool: result.base_alcool || null,
    verre_type: result.verre || null,
    description_courte: inspi.notes || null,
    photo_url: inspi.photo_url || null,
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
      <button class="btn-primary" style="width:100%" onclick="lancerConcoction('${r.id}')">
        ⚗️ Lancer cette recette → Concoctions
      </button>
    </div>
  `;

  afficherModal('modal-fiche-grimoire');
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

function renderDashboardSaison(plantesData, grimoireData) {
  const moisActuel = new Date().getMonth() + 1;
  const moisSuivant = moisActuel === 12 ? 1 : moisActuel + 1;
  const moisNoms = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const plantesSaison = plantesData.filter(p =>
    p.disponibilite_mois?.includes(moisActuel) || p.disponibilite_mois?.includes(moisSuivant)
  );
  if (plantesSaison.length === 0) return '';
  const alertesToutes = plantesSaison.map(plante => {
    const enSaison = plante.disponibilite_mois?.includes(moisActuel);
    const recettesAssociees = grimoireData.filter(g =>
      g.plante_ids?.includes(plante.id) ||
      (plante.categories_preparation || []).some(cat => g.categorie === cat)
    ).slice(0, 3);
    return { plante, enSaison, recettesAssociees };
  }).sort((a, b) => (b.enSaison === true) - (a.enSaison === true));
  const alertes = alertesToutes.slice(0, 4);
  const restantes = alertesToutes.length - alertes.length;
  return `
    <div class="dash-card">
      <div class="dash-card-header">
        <span class="dash-card-titre">📅 En ce moment — ${moisNoms[moisActuel]}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
        ${alertes.map(({ plante, enSaison, recettesAssociees }) => `
          <div class="dash-saison-card" onclick="ouvrirFicheSaisonniere('${plante.id}')">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:1.8rem">${plante.emoji}</span>
              <div style="flex:1">
                <div style="font-weight:600;font-size:0.9rem">${plante.nom}</div>
                <div style="font-size:0.78rem;color:var(--text-secondary)">${plante.profil_aromatique || ''}</div>
              </div>
              <span style="font-size:0.72rem;padding:3px 8px;border-radius:20px;
                background:${enSaison ? 'var(--bg-success)' : 'var(--bg-warning)'};
                color:${enSaison ? 'var(--text-success)' : 'var(--text-warning)'}">
                ${enSaison ? '● En saison' : '◎ Bientôt'}
              </span>
            </div>
            ${recettesAssociees.length > 0 ? `
            <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
              ${recettesAssociees.map(r => `
                <span style="font-size:0.72rem;padding:2px 8px;background:var(--bg-accent);color:var(--text-accent);border-radius:20px">
                  ${r.avec_alcool ? '🍶' : '🌿'} ${r.nom}
                </span>`).join('')}
            </div>` : ''}
          </div>
        `).join('')}
        ${restantes > 0 ? `<div style="text-align:center;font-size:0.78rem;color:var(--text-secondary);padding:4px">+${restantes} autre${restantes > 1 ? 's' : ''} en saison ce mois-ci</div>` : ''}
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
