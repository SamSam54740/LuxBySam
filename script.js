// ==========================================
// 1. VARIABLE GLOBALES
// ==========================================
let products = [];
let cart = [];
let currentCategory = '';
let currentSort = 'alpha';
let views = {};
let ui = {};
let suggestions = [];

// ==========================================
// 2. INITIALISATION SÉCURISÉE (Le correctif)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // On initialise les éléments DOM une fois que la page est prête
    views = {
        home: document.getElementById('view-categories'),
        products: document.getElementById('view-products'),
        cart: document.getElementById('view-cart'),
        admin: document.getElementById('view-admin'),
        confirmation: document.getElementById('view-confirmation')
    };

    ui = {
        gateModal: document.getElementById('gate-modal'),
        header: document.getElementById('main-header'),
        mainContent: document.getElementById('main-content'),
        footer: document.getElementById('main-footer'),
        searchInput: document.getElementById('search-input'),
        searchDropdown: document.getElementById('search-dropdown'),
        clearSearch: document.getElementById('clear-search'),
        searchSection: document.getElementById('search-section'),
        navAdminBtn: document.getElementById('nav-admin-btn')
    };

    await chargerCatalogue(); 
    
    const role = sessionStorage.getItem('luxbysam_role');
    if (role === 'user' || role === 'admin') {
        unlockSite(role);
    }
    setupEventListeners();
    updateCartUI();
});

async function chargerCatalogue() {
    try {
        const response = await fetch('catalogue_dfs.csv');
        const data = await response.text();
        const lignes = data.split('\n');
        products = []; 

        for (let i = 1; i < lignes.length; i++) {
            if (lignes[i].trim() === '') continue;
            let separateur = lignes[i].split(',').length > lignes[i].split(';').length ? ',' : ';';
            const colonnes = lignes[i].split(separateur);
            let isNewFormat = colonnes.length >= 7;

            if (colonnes.length >= 6) {
                let prixCoutant = parseFloat(colonnes[4].replace(/"/g, '').replace(',', '.').trim());
                let prixVente = isNewFormat ? parseFloat(colonnes[5].replace(/"/g, '').replace(',', '.').trim()) : prixCoutant;
                let photo = isNewFormat ? colonnes[6].replace(/"/g, '').trim() : colonnes[5].replace(/"/g, '').trim();
                let desc = colonnes[3].replace(/"/g, '').trim();
                let nom = colonnes[2].replace(/"/g, '').trim();
                let cat = colonnes[1].replace(/"/g, '').trim();

                if (nom && !isNaN(prixCoutant)) {
                    products.push({ id: i, cat: cat, name: nom, desc: desc, priceCost: prixCoutant, price: prixVente, img: 'photos_produits/' + photo });
                }
            }
        }
        console.log(`✅ Catalogue chargé ! ${products.length} produits affichés.`);
    } catch (erreur) { console.error("❌ Erreur de lecture du CSV.", erreur); }
}

// ==========================================
// 3. SÉCURITÉ DU PORTAIL DISCRET
// ==========================================
document.getElementById('btn-enter').addEventListener('click', () => {
    const code = document.getElementById('access-code').value.toLowerCase();
    const isAdult = document.getElementById('age-check').checked;
    
    if (isAdult && (code === 'lux123' || code === 'admin')) {
        sessionStorage.setItem('luxbysam_role', code);
        unlockSite(code);
        if (code === 'admin') showAdminPage();
    } else {
        document.getElementById('gate-error').classList.remove('hidden');
    }
});

function unlockSite(role) {
    // Au lieu de cacher, on supprime l'élément du DOM pour qu'il ne bloque plus rien
    const gate = document.getElementById('gate-modal');
    if (gate) gate.remove(); 
    
    ui.header.classList.remove('hidden');
    ui.mainContent.classList.remove('hidden');
    ui.footer.classList.remove('hidden');
    
    if (role === 'admin') {
        ui.navAdminBtn.classList.remove('hidden');
        document.getElementById('nav-lock-btn').classList.remove('hidden');
    }
}

window.lockSite = function() {
    sessionStorage.removeItem('luxbysam_role');
    location.reload(); 
};

// ==========================================
// 4. ÉVÉNEMENTS & NAVIGATION GÉNÉRALE
// ==========================================
function setupEventListeners() {
    document.getElementById('go-home').addEventListener('click', showHome);
    document.getElementById('btn-back-cats').addEventListener('click', showHome);
    document.getElementById('btn-back-from-cart').addEventListener('click', showHome);
    document.getElementById('btn-back-home').addEventListener('click', showHome);
    ui.navAdminBtn.addEventListener('click', showAdminPage);

    document.querySelectorAll('.glass-card').forEach(block => {
        block.addEventListener('click', (e) => {
            currentCategory = e.currentTarget.dataset.cat;
            showCategory();
        });
    });

    document.getElementById('sort-select').addEventListener('change', (e) => {
        currentSort = e.target.value;
        showCategory();
    });

    // BARRE DE RECHERCHE SIMPLE (Sans interférence)
    ui.searchInput.addEventListener('input', handleSearchDropdown);
    ui.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); 
        executeSearch(ui.searchInput.value);
    }
    });
    ui.clearSearch.addEventListener('click', closeSearch);

    document.getElementById('open-cart').addEventListener('click', showCartPage);
    document.getElementById('checkout-form').addEventListener('submit', handleCheckout);

}



function hideAllViews() {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    ui.searchSection.classList.remove('hidden'); 
}

function showHome() { hideAllViews(); closeSearch(); views.home.classList.remove('hidden'); }
function closeSearch() { ui.searchInput.value = ''; ui.searchDropdown.classList.add('hidden'); ui.clearSearch.classList.add('hidden'); }

// ==========================================
// 5. MOTEUR DE RECHERCHE
// ==========================================
function handleSearchDropdown(e) {
    const query = e.target.value.toLowerCase().trim();
    
    if (query.length < 2) { 
        ui.searchDropdown.classList.add('hidden');
        ui.clearSearch.classList.add('hidden');
        return; 
    }
    ui.clearSearch.classList.remove('hidden');
    const results = products.filter(p => p.name.toLowerCase().includes(query) || p.cat.toLowerCase().includes(query));
    ui.searchDropdown.innerHTML = '';
    
    if (results.length === 0) {
        ui.searchDropdown.innerHTML = `<li onclick="executeSearch('${query}')"><div class="sd-info text-center" style="width:100%; color:var(--lux-red); padding:10px;"><strong>Aucun produit trouvé 😕</strong><br><span style="font-size:0.85rem; color:#666;">Proposer "${query}" à Sam</span></div></li>`;
    } else {
        results.slice(0, 5).forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `<img src="${p.img}" alt="img"><div class="sd-info"><div class="sd-name">${p.name}</div><div class="sd-cat">${p.cat}</div></div><div class="sd-price">${p.price.toFixed(2)} €</div>`;
            li.addEventListener('click', () => {
                closeSearch(); hideAllViews();
                document.getElementById('current-category-title').innerText = "Résultat : " + p.name;
                views.products.classList.remove('hidden');
                document.getElementById('products-container').innerHTML = renderProductCard(p);
            });
            ui.searchDropdown.appendChild(li);
        });
        ui.searchDropdown.insertAdjacentHTML('beforeend', `<li onclick="executeSearch('${query}')" style="background:var(--bg-light); justify-content:center;"><strong style="color:var(--lux-blue);">🔍 Voir tous les résultats (${results.length})</strong></li>`);
    }
    ui.searchDropdown.classList.remove('hidden');
}

window.executeSearch = function(query) {
    if (!query) return;
    query = query.toLowerCase().trim();
    closeSearch(); hideAllViews();
    document.getElementById('current-category-title').innerText = `Recherche : "${query}"`;
    views.products.classList.remove('hidden');

    const results = products.filter(p => p.name.toLowerCase().includes(query) || p.cat.toLowerCase().includes(query));
    const container = document.getElementById('products-container');
    container.innerHTML = '';

    if (results.length > 0) {
        results.forEach(p => container.insertAdjacentHTML('beforeend', renderProductCard(p)));
        container.insertAdjacentHTML('beforeend', `<div class="suggestion-box" style="grid-column:1/-1; margin-top:30px;"><h4>Votre déclinaison exacte n'y est pas ?</h4><form id="suggest-form" onsubmit="handleSuggestion(event)"><input type="text" id="suggest-name" value="${query}" required><button type="submit" class="btn-outline mt-10">Proposer à Sam</button></form></div>`);
    } else {
        container.innerHTML = `<div class="suggestion-box" style="grid-column:1/-1;"><div style="font-size:3rem; margin-bottom:15px;">🕵️‍♂️</div><h3>Oups, aucun produit trouvé pour "${query}"</h3><p>Demandez-le ! Sam essaiera de l'ajouter au catalogue lors de son prochain passage.</p><form id="suggest-form" onsubmit="handleSuggestion(event)"><input type="text" id="suggest-name" value="${query}" required><button type="submit" class="btn-lux-blue w-100 mt-10">Envoyer ma demande</button></form></div>`;
    }
};

window.handleSuggestion = function(e) {
    e.preventDefault();
    const prodName = document.getElementById('suggest-name').value;
    suggestions.push({ name: prodName, date: new Date().toLocaleDateString('fr-FR') });
    customAlert(`✅ Merci ! Votre demande pour "${prodName}" a bien été transmise à Sam.`);
    document.getElementById('suggest-form').reset();
};

function showCategory() {
    hideAllViews();
    document.getElementById('current-category-title').innerText = currentCategory;
    views.products.classList.remove('hidden');

    let filtered = products.filter(p => p.cat === currentCategory);
    if (currentSort === 'alpha') filtered.sort((a, b) => a.name.localeCompare(b.name));
    else if (currentSort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
    else if (currentSort === 'price-desc') filtered.sort((a, b) => b.price - a.price);

    const container = document.getElementById('products-container');
    container.innerHTML = '';
    filtered.forEach(p => container.insertAdjacentHTML('beforeend', renderProductCard(p)));
}

function renderProductCard(p) {
    return `
    <div class="product-card">
        <div class="card-image-wrapper">
            <img src="${p.img}" alt="${p.name}" loading="lazy" onclick="openImageModal('${p.img}')" style="width:100%; height:130px; object-fit:contain; margin-bottom:15px; cursor:zoom-in;">
        </div>
        <h3>${p.name}</h3>
        <p class="prod-desc">${p.desc}</p>
        <div class="price-row">
            <span class="final-price">${p.price.toFixed(2)} €</span>
            <button class="btn-add" id="btn-add-${p.id}" onclick="addToCart(${p.id})">Ajouter</button>
        </div>
    </div>`;
}

// ==========================================
// 6. PANIER & COMMANDE
// ==========================================
window.addToCart = function(id) {
    const product = products.find(p => p.id === id);
    const existing = cart.find(item => item.id === id);
    if (existing) { existing.qty++; } else { cart.push({ ...product, qty: 1 }); }
    updateCartUI();
    
    const btn = document.getElementById(`btn-add-${id}`);
    if(btn) { btn.innerText = "✓"; btn.classList.add('added'); setTimeout(() => { btn.innerText = "Ajouter"; btn.classList.remove('added'); }, 1000); }
    const cartIcon = document.getElementById('open-cart');
    cartIcon.classList.remove('cart-bounce'); void cartIcon.offsetWidth; cartIcon.classList.add('cart-bounce');
};

function showCartPage() { hideAllViews(); ui.searchSection.classList.add('hidden'); views.cart.classList.remove('hidden'); updateCartUI(); }

function updateCartUI() {
    document.getElementById('cart-count').innerText = cart.reduce((sum, item) => sum + item.qty, 0);
    const container = document.getElementById('cart-page-items');
    const summary = document.getElementById('cart-page-summary');

    if (cart.length === 0) {
        container.innerHTML = '<div style="background:white; padding:40px; border-radius:16px; text-align:center; box-shadow:var(--shadow); color:#888;">🛒 Votre panier est vide.</div>';
        summary.classList.add('hidden'); return;
    }

    summary.classList.remove('hidden'); container.innerHTML = ''; let total = 0;
    cart.forEach(item => {
        let itemTotal = item.price * item.qty; total += itemTotal;
        container.insertAdjacentHTML('beforeend', `<div class="cart-item-row"><img src="${item.img}" alt="img"><div class="ci-details"><strong>${item.name}</strong><span class="ci-price-u">${item.price.toFixed(2)} € / u</span></div><div class="ci-qty-controls"><button onclick="changeQty(${item.id}, -1)">-</button><span>${item.qty}</span><button onclick="changeQty(${item.id}, 1)">+</button></div><div class="ci-total">${itemTotal.toFixed(2)} €</div></div>`);
    });
    document.getElementById('total-price-val').innerText = total.toFixed(2);
}

window.changeQty = function(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return; item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
    updateCartUI();
};

function handleCheckout(e) {
    e.preventDefault();
    const name = document.getElementById('client-name').value;
    const orderId = 'LBS-' + Math.floor(10000 + Math.random() * 90000);
    let total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0).toFixed(2);
    
    let htmlRecap = `<table style="width:100%; border-collapse:collapse;">`;
    cart.forEach(item => {
        htmlRecap += `<tr><td style="padding:15px 0; border-bottom:1px solid #eee;"><strong>${item.name}</strong><br><span style="color:#888;">Qté: ${item.qty}</span></td><td style="padding:15px 0; border-bottom:1px solid #eee; text-align:right; font-weight:bold;">${(item.price * item.qty).toFixed(2)} €</td></tr>`;
    });
    htmlRecap += `</table>`;

    hideAllViews(); ui.searchSection.classList.add('hidden');
    document.getElementById('conf-name').innerText = name;
    document.getElementById('order-number').innerText = orderId;
    views.confirmation.classList.remove('hidden');

    envoyerEmailConfirmation(name, document.getElementById('client-email').value, orderId, htmlRecap, total);
    cart = []; updateCartUI(); document.getElementById('checkout-form').reset();
}

function envoyerEmailConfirmation(nom, email, orderId, htmlRecap, total) {
    emailjs.send('service_lrtfieb', 'template_0p0rev9', { client_name: nom, client_email: email, order_id: orderId, recap_html: htmlRecap, total_commande: total })
        .then(() => console.log('✅ Email envoyé !'), (err) => customAlert('Erreur EmailJS : ' + err.text));
}

// ==========================================
// 7. ZOOM IMAGE (LIGHTBOX)
// ==========================================
window.openImageModal = function(imgSrc) {
    document.getElementById('large-image').src = imgSrc;
    document.getElementById('image-modal').style.display = 'flex';
};
window.closeImageModal = function() { document.getElementById('image-modal').style.display = 'none'; };
document.getElementById('image-modal').addEventListener('click', function(e) { if (e.target === this) closeImageModal(); });

// ==========================================
// 8. TABLEAU DE BORD ADMIN
// ==========================================
function showAdminPage() {
    hideAllViews(); ui.searchSection.classList.add('hidden'); views.admin.classList.remove('hidden');
    switchAdminTab('tab-commandes'); // Ouvre par défaut l'onglet commande
}

window.switchAdminTab = function(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(tab => { tab.classList.remove('active'); tab.classList.add('hidden'); });
    event.currentTarget.classList.add('active');
    document.getElementById(tabId).classList.remove('hidden');
    document.getElementById(tabId).classList.add('active');

    if (tabId === 'tab-prix') loadAdminPrices();
    if (tabId === 'tab-commandes') loadAdminOrders();
    if (tabId === 'tab-finances') { renderExpenses(); initCharts(); }
    if (tabId === 'tab-suggestions') renderSuggestions();
};

// --- GESTION DES PRIX ---
window.loadAdminPrices = function() {
    let cat = document.getElementById('admin-cat-select').value;
    let tbody = document.getElementById('admin-price-list'); tbody.innerHTML = ''; 
    products.filter(p => p.cat === cat).forEach(p => {
        tbody.insertAdjacentHTML('beforeend', `<tr><td>${p.name}</td><td style="color:#dc3545; font-weight:bold;">${p.priceCost.toFixed(2)} €</td><td><input type="number" class="admin-price-input" data-id="${p.id}" value="${p.price.toFixed(2)}" step="0.50" style="width:100px; padding:5px; text-align:center;"> €</td></tr>`);
    });
};

window.applyBulkIncrease = function() {
    let increaseVal = parseFloat(document.getElementById('bulk-price-increase').value);
    if (isNaN(increaseVal)) return customAlert("Veuillez entrer un montant valide !");
    
    document.querySelectorAll('.admin-price-input').forEach(input => { 
        let newVal = parseFloat(input.value) + increaseVal;
        if(newVal < 0) newVal = 0; // Empêche un prix de passer en dessous de 0€
        input.value = newVal.toFixed(2); 
    });
    customAlert(`Ajustement de ${increaseVal > 0 ? '+' : ''}${increaseVal}€ appliqué à l'écran !`);
};

window.saveNewPrices = function() {
    document.querySelectorAll('.admin-price-input').forEach(input => {
        let p = products.find(prod => prod.id === parseInt(input.getAttribute('data-id')));
        if(p) p.price = parseFloat(input.value);
    });
    let csvContent = "ID;Categorie;Nom;Description;PrixCoutant;PrixVente;NomPhoto\n";
    products.forEach(p => csvContent += `${p.id};${p.cat};${p.name};${p.desc};${p.priceCost};${p.price};${p.img.split('/').pop()}\n`);
    
    let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "catalogue_dfs.csv";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    customAlert("✅ Fichier généré ! Remplacez l'ancien catalogue_dfs.csv par celui-ci.");
};

// --- GESTION DES COMMANDES ---
let adminOrders = [
    { id: 'LBS-84092', client: 'Jean Dupont', email: 'jean@dupont.com', phone: '06 12 34 56 78', date: '22/06/2026', total: 145.00, status: 'pending', items: '2x Camel Bleu, 1x Whisky' },
    { id: 'LBS-55410', client: 'Marc Dubois', email: 'marc.dubois@mail.com', phone: '07 88 99 00 11', date: '22/06/2026', total: 320.00, status: 'progress', items: '4x Marlboro Red, 2x Tabac Ajja' },
    { id: 'LBS-30291', client: 'Marie L.', email: 'marie.l@mail.com', phone: 'Non renseigné', date: '21/06/2026', total: 80.50, status: 'delivered', items: '1x Marlboro Gold' }
];
let currentEditingOrderId = null;

function loadAdminOrders() {
    const tbody = document.getElementById('admin-orders-list'); tbody.innerHTML = '';
    adminOrders.forEach(order => {
        let badgeClass = '', statusText = '';
        if(order.status === 'pending') { badgeClass = 'badge-pending'; statusText = 'En attente'; }
        if(order.status === 'progress') { badgeClass = 'badge-progress'; statusText = 'En livraison'; }
        if(order.status === 'delivered') { badgeClass = 'badge-delivered'; statusText = 'Livrée'; }
        if(order.status === 'cancelled') { badgeClass = 'badge-cancelled'; statusText = 'Annulée'; }
        tbody.insertAdjacentHTML('beforeend', `<tr><td><strong>${order.id}</strong></td><td>${order.client}</td><td>${order.date}</td><td><strong>${order.total.toFixed(2)} €</strong></td><td><span class="badge ${badgeClass}">${statusText}</span></td><td><button class="btn-outline" onclick="openOrderModal('${order.id}')" style="padding:5px 10px; font-size:0.8rem;">Gérer</button></td></tr>`);
    });
}

window.openOrderModal = function(orderId) {
    const order = adminOrders.find(o => o.id === orderId);
    if(!order) return;
    currentEditingOrderId = orderId;
    document.getElementById('om-title').innerText = `Commande ${order.id}`;
    document.getElementById('om-content').innerHTML = `
        <div class="order-detail-line"><span>Client :</span> <strong>${order.client}</strong></div>
        <div class="order-detail-line"><span>Contact :</span> <div style="text-align:right"><strong>${order.email}</strong><br><small style="color:#666;">${order.phone}</small></div></div>
        <div class="order-detail-line"><span>Date :</span> <strong>${order.date}</strong></div>
        <div class="order-detail-line"><span>Total :</span> <strong style="color:var(--lux-blue); font-size:1.2rem;">${order.total.toFixed(2)} €</strong></div>
        <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px;"><strong>Contenu :</strong><br>${order.items}</div>`;
    document.getElementById('om-status').value = order.status;
    document.getElementById('order-modal').classList.remove('hidden');
};
window.closeOrderModal = function() { document.getElementById('order-modal').classList.add('hidden'); };
window.saveOrderStatus = function() {
    const order = adminOrders.find(o => o.id === currentEditingOrderId);
    if(order) { order.status = document.getElementById('om-status').value; loadAdminOrders(); closeOrderModal(); }
};

// --- GESTION DES FINANCES & FACTURES ---
let expensesList = [
    { id: 1, name: "Achat gros volume DFS", amount: 820.00, date: "21/06/2026" },
    { id: 2, name: "Plein d'essence Total", amount: 45.00, date: "20/06/2026" }
];

function renderExpenses() {
    const ul = document.getElementById('expenses-list');
    ul.innerHTML = '';
    let total = 0;
    expensesList.forEach(exp => {
        total += exp.amount;
        ul.insertAdjacentHTML('beforeend', `
            <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 0.95rem;">
                <span><span style="color: #888; margin-right: 10px;">${exp.date}</span> <strong>${exp.name}</strong></span>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span class="text-red font-weight-bold">- ${exp.amount.toFixed(2)} €</span>
                    <span class="cursor-pointer" onclick="deleteExpense(${exp.id})" style="color: #dc3545; font-size: 1.1rem;" title="Supprimer">🗑️</span>
                </div>
            </li>`);
    });
    document.getElementById('expense-amount-total').innerText = `- ${total.toFixed(2)} €`;
}

window.addExpense = function() {
    document.getElementById('expense-name-input').value = '';
    document.getElementById('expense-amount-input').value = '';
    document.getElementById('expense-modal').classList.remove('hidden');
};

window.validateExpense = function() {
    let name = document.getElementById('expense-name-input').value;
    let amount = parseFloat(document.getElementById('expense-amount-input').value.replace(',', '.'));
    
    if (!name || isNaN(amount) || amount <= 0) {
        customAlert("Veuillez remplir correctement la désignation et le montant.");
        return;
    }
    
    let today = new Date().toLocaleDateString('fr-FR');
    expensesList.unshift({ id: Date.now(), name: name, amount: amount, date: today });
    renderExpenses();
    document.getElementById('expense-modal').classList.add('hidden');
    customAlert("✅ Facture ajoutée au bilan !");
};

window.deleteExpense = function(id) {
    expensesList = expensesList.filter(exp => exp.id !== id);
    renderExpenses();
};

// --- GRAPHIQUES (CHART.JS) ---
let chartsLoaded = false;
function initCharts() {
    if (chartsLoaded) return;
    chartsLoaded = true;

    const ctxPie = document.getElementById('salesPieChart').getContext('2d');
    new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Cigarettes', 'Tabac', 'Alcools', 'Cigares'],
            datasets: [{ data: [65, 20, 10, 5], backgroundColor: ['#0b1d3a', '#d4af37', '#10b981', '#881337'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const ctxBar = document.getElementById('revenueBarChart').getContext('2d');
    new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
            datasets: [{ label: 'Revenus (€)', data: [120, 190, 80, 250, 320, 410, 150], backgroundColor: '#d4af37', borderRadius: 5 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderSuggestions() {
    const tbody = document.getElementById('admin-suggestions-list');
    tbody.innerHTML = suggestions.map(s => `<tr><td>${s.name}</td><td>${s.date}</td></tr>`).join('');
}

// --- ALERTES SUR MESURE ---
window.customAlert = function(msg) {
    document.getElementById('custom-alert-text').innerText = msg;
    document.getElementById('custom-alert-modal').classList.remove('hidden');
};
window.closeCustomAlert = function() {
    document.getElementById('custom-alert-modal').classList.add('hidden');
};

