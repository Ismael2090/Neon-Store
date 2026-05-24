const productosFallback = [
    { id: 1, nombre: "Anillo de Garra Dragón", categoria: "Anillos", precio: 350.00, stock: 15, estado: "Disponible", imagen: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500" },
    { id: 2, nombre: "Collares Compartidos Yin Yang", categoria: "Collares", precio: 450.00, stock: 5, estado: "Disponible", imagen: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500" },
    { id: 3, nombre: "Pulsera de Cuero Ajustable", categoria: "Pulseras", precio: 250.00, stock: 22, estado: "Disponible", imagen: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=500" },
    { id: 4, nombre: "Poster Hunter x Hunter - Killua", categoria: "Posters Anime", precio: 180.00, stock: 10, estado: "Disponible", imagen: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500" }
];

let productos = [];
let pedidos = [];
let carritoActual = [];
let cestaActual = [];
let likes = [];
let notificacionesPedidos = [];
let solicitudPedidoActual = null;
let notificacionesPolling = null;
let seccionActiva = "Anillos";
let imagenBase64Temporal = "";

const authState = { user: null };
const authSelectors = {};

// Sistema de físicas del fondo animado
let elementosFlotantes = [];
let loopAnimacionFondo = null;

const metadatosSecciones = {
    "Anillos": {
        titulo: "Sección Anillos",
        desc: "Gestión de sortijas, anillos de plata, acero y diseños de anime.",
        img: "linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.9)), url('https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=1000')"
    },
    "Collares": {
        titulo: "Sección Collares",
        desc: "Cadenas, gargantillas y colgantes personalizados hechos a mano.",
        img: "linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.9)), url('https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1000')"
    },
    "Pulseras": {
        titulo: "Sección Pulseras",
        desc: "Línea de pulseras de hilo, personalizadas con piedras volcánicas.",
        img: "linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.9)), url('https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=1000')"
    },
    "Posters Anime": {
        titulo: "Colección Posters Anime",
        desc: "Impresiones de alta definición de tus series y mangas favoritos.",
        img: "linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.9)), url('https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000')"
    }
};

function normalizarProducto(prod) {
    return {
        id: prod.id,
        nombre: prod.name || prod.nombre || 'Producto sin nombre',
        categoria: prod.category || prod.categoria || 'Sin categoría',
        precio: Number(prod.price ?? prod.precio ?? 0),
        stock: Number(prod.stock ?? 0),
        estado: prod.estado || (Number(prod.stock ?? 0) > 0 ? 'Disponible' : 'Agotado'),
        imagen: prod.image || prod.imagen || prod.imagenUrl || prod.url || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500'
    };
}

document.addEventListener('DOMContentLoaded', () => {
    configurarFechaActual();
    authSelectors.authScreen = document.getElementById('auth-screen');
    authSelectors.appContainer = document.querySelector('.app-container');
    authSelectors.loginSection = document.getElementById('auth-login');
    authSelectors.registerSection = document.getElementById('auth-register');
    authSelectors.profileEditor = document.getElementById('profile-editor-panel');
    authSelectors.profileUsername = document.getElementById('profile-username-edit');
    authSelectors.profileFullName = document.getElementById('profile-fullname-edit');
    authSelectors.profilePhone = document.getElementById('profile-phone-edit');
    authSelectors.profilePhoto = document.getElementById('profile-photo-edit');

    mostrarAuthSection('login');
    cargarUsuarioActual();

    window.onclick = function(event) {
        if (!event.target.matches('.dropdown-btn')) {
            cerrarTodosLosDropdowns();
        }
    }
});

function guardarDatos() {
    actualizarEstadisticasInicio();
}

function showNotification(message, type = 'success') {
    const toast = document.getElementById('app-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `app-toast ${type}`;
    toast.classList.remove('hidden');
    clearTimeout(showNotification.timeoutId);
    showNotification.timeoutId = setTimeout(() => toast.classList.add('hidden'), 4000);
}

function getCestaStorageKey() {
    return `neon-cesta-${authState.user?.username || 'guest'}`;
}

function getNotificacionesStorageKey() {
    return 'neon-notificaciones';
}

function cargarNotificacionesLocal() {
    // Admins: load notifications from server so all admins see them
    if (authState.user?.role === 'admin') {
        (async () => {
            try {
                console.log('[cargarNotificacionesLocal] Admin solicitando notificaciones...');
                const resp = await fetch('/api/requests', { credentials: 'include' });
                console.log('[cargarNotificacionesLocal] Respuesta status:', resp.status);
                const data = await resp.json();
                console.log('[cargarNotificacionesLocal] Datos recibidos:', data);
                
                if (resp.ok && data.requests) {
                    console.log('[cargarNotificacionesLocal] Procesando', data.requests.length, 'solicitudes');
                    notificacionesPedidos = data.requests.map(r => ({
                        id: r.id,
                        username: r.username,
                        customerName: r.customer_name,
                        phone: r.phone,
                        instagram: r.instagram,
                        amount: r.amount,
                        // keep product id, quantity and price so quick-convert can create orders
                        items: (r.items || []).map(i => ({ idProducto: i.product_id, nombre: i.nombre, cantidad: i.quantity, precioUnitario: i.price })),
                        status: r.status,
                        createdAt: r.created_at
                    }));
                    console.log('[cargarNotificacionesLocal] Mapeadas', notificacionesPedidos.length, 'notificaciones');
                } else {
                    console.warn('[cargarNotificacionesLocal] Respuesta no ok o sin requests:', data);
                    notificacionesPedidos = [];
                }
            } catch (err) {
                console.error('[cargarNotificacionesLocal] Error en fetch:', err);
                notificacionesPedidos = [];
            }
            actualizarBadgeNotificaciones();
            renderizarNotificaciones();
        })();
        return;
    }

    try {
        const stored = localStorage.getItem(getNotificacionesStorageKey());
        notificacionesPedidos = stored ? JSON.parse(stored) : [];
    } catch (err) {
        notificacionesPedidos = [];
    }
    actualizarBadgeNotificaciones();
    renderizarNotificaciones();
}

window.addEventListener('storage', (event) => {
    if (event.key === getNotificacionesStorageKey()) {
        cargarNotificacionesLocal();
    }
});

function guardarNotificacionesLocal() {
    try {
        localStorage.setItem(getNotificacionesStorageKey(), JSON.stringify(notificacionesPedidos));
    } catch (err) {
        console.warn('No se pudo guardar las notificaciones', err);
    }
}

function actualizarBadgeNotificaciones() {
    const badge = document.getElementById('notificacion-count');
    if (!badge) return;
    const count = notificacionesPedidos.filter(notif => notif.status === 'Pendiente').length;
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
}

function renderizarNotificaciones() {
    const tbody = document.getElementById('notificaciones-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (notificacionesPedidos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dark-muted);">No hay solicitudes de pedido pendientes.</td></tr>`;
        return;
    }

    notificacionesPedidos.forEach(notif => {
        const itemsText = notif.items.map(item => `${item.cantidad}x ${item.nombre}`).join('<br>');
        tbody.innerHTML += `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <strong>${notif.customerName}</strong>
                        <span style="background:linear-gradient(90deg,var(--neon-cyan),var(--neon-pink)); padding:2px 8px; border-radius:12px; font-size:12px; color:#000;">Nueva solicitud de ${notif.username}</span>
                    </div>
                    <div style="margin-top:6px; font-size:12px; color:var(--text-dark-muted);">@${notif.username}</div>
                    <div style="margin-top:6px; font-size:12px; color:var(--neon-cyan);">📞 ${notif.phone || 'No especificado'}</div>
                    <div style="margin-top:4px; font-size:12px; color:var(--neon-pink);">📸 ${notif.instagram || 'No especificado'}</div>
                </td>
                <td>$${Number(notif.amount).toFixed(2)}</td>
                <td>${itemsText}</td>
                <td>${new Date(notif.createdAt).toLocaleString()}</td>
                <td><span class="badge ${notif.status === 'Procesado' ? 'disponible' : 'agotado'}">${notif.status}</span></td>
                <td style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn-primary-neon" type="button" onclick="cargarSolicitudEnPedido(${notif.id})">Cargar al pedido</button>
                    <button class="btn-secondary-neon" type="button" onclick="convertirSolicitudRapida(${notif.id})">➡️ Convertir rápido</button>
                    <button class="btn-danger" type="button" onclick="descartarSolicitud(${notif.id})">Descartar</button>
                </td>
            </tr>
        `;
    });
}

async function solicitarPedidoAdmin() {
    if (!authState.user) {
        showNotification('Inicia sesión para enviar tu pedido', 'error');
        return;
    }
    if (cestaActual.length === 0) {
        showNotification('Tu cesta está vacía. Agrega productos antes de enviar el pedido.', 'error');
        return;
    }

    const phone = document.getElementById('cesta-telefono')?.value.trim() || '';
    const instagram = document.getElementById('cesta-instagram')?.value.trim() || '';
    const total = cestaActual.reduce((acc, item) => acc + item.subtotal, 0);

    const notificacion = {
        username: authState.user.username,
        customerName: authState.user.fullName || authState.user.username,
        phone,
        instagram,
        amount: total,
        items: cestaActual.map(item => ({ idProducto: item.idProducto, nombre: item.nombre, cantidad: item.cantidad, precioUnitario: item.precioUnitario }))
    };

    const sendBtn = document.getElementById('cesta-enviar-btn');
    const sendText = document.getElementById('cesta-enviar-text');
    const sendSpinner = document.getElementById('cesta-enviar-spinner');
    if (sendBtn) sendBtn.classList.add('loading');
    if (sendSpinner) sendSpinner.classList.remove('hidden');
    if (sendText) sendText.textContent = 'Enviando...';

    try {
        const payload = { 
            customerName: notificacion.customerName, 
            phone: notificacion.phone, 
            instagram: notificacion.instagram, 
            items: notificacion.items, 
            total: notificacion.amount 
        };
        
        console.log('[solicitarPedidoAdmin] Enviando payload:', payload);
        
        const resp = await fetch('/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        
        console.log('[solicitarPedidoAdmin] Respuesta status:', resp.status);
        const data = await resp.json();
        console.log('[solicitarPedidoAdmin] Respuesta datos:', data);
        
        if (!resp.ok) {
            showNotification(data.message || 'No se pudo enviar la solicitud', 'error');
            console.error('[solicitarPedidoAdmin] Error:', data);
            return;
        }
        
        // locally clear basket and update UI
        cestaActual = [];
        guardarCestaLocal();
        renderizarCesta();
        showNotification('Solicitud enviada al administrador correctamente ✓');
        
        // Actualizar notificaciones inmediatamente
        if (authState.user?.role === 'admin') {
            await cargarNotificacionesLocal();
        }
    } catch (err) {
        console.error('[solicitarPedidoAdmin] Error de conexión:', err);
        showNotification('Error de conexión al enviar la solicitud', 'error');
    } finally {
        if (sendBtn) sendBtn.classList.remove('loading');
        if (sendSpinner) sendSpinner.classList.add('hidden');
        if (sendText) sendText.textContent = '✉️ Enviar solicitud de pedido';
    }
}

async function cargarSolicitudEnPedido(idSolicitud) {
    const solicitud = notificacionesPedidos.find(item => item.id === idSolicitud);
    if (!solicitud) {
        showNotification('Solicitud no encontrada', 'error');
        return;
    }

    solicitudPedidoActual = idSolicitud;
    carritoActual = solicitud.items.map(item => ({ ...item }));
    renderizarCarrito();
    document.getElementById('ped-cliente').value = solicitud.customerName;
    document.getElementById('ped-telefono').value = solicitud.phone || '';
    document.getElementById('ped-instagram').value = solicitud.instagram || '';
    document.getElementById('ped-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('ped-estado').value = 'Pendiente';
    showNotification('Solicitud cargada al formulario de pedido. Revisa y confirma.');
    cambiarPestana('pedidos');
}

function descartarSolicitud(idSolicitud) {
    notificacionesPedidos = notificacionesPedidos.filter(item => item.id !== idSolicitud);
    guardarNotificacionesLocal();
    actualizarBadgeNotificaciones();
    renderizarNotificaciones();
    showNotification('Solicitud descartada.');
}

function cargarCestaLocal() {
    try {
        if (!authState.user) {
            cestaActual = [];
            return;
        }
        const stored = localStorage.getItem(getCestaStorageKey());
        cestaActual = stored ? JSON.parse(stored) : [];
        renderizarCesta();
    } catch (err) {
        cestaActual = [];
    }
}

function guardarCestaLocal() {
    try {
        if (!authState.user) return;
        localStorage.setItem(getCestaStorageKey(), JSON.stringify(cestaActual));
    } catch (err) {
        console.warn('No se pudo guardar la cesta', err);
    }
}

function renderizarCesta() {
    const tbody = document.getElementById('cesta-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    let total = 0;
    if (cestaActual.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-dark-muted);">Aún no hay productos guardados en la cesta.</td></tr>`;
    } else {
        cestaActual.forEach((item, idx) => {
            item.subtotal = item.cantidad * item.precioUnitario;
            total += item.subtotal;
            tbody.innerHTML += `
                <tr>
                    <td>${item.nombre}</td>
                    <td>$${item.precioUnitario.toFixed(2)}</td>
                    <td>${item.cantidad}</td>
                    <td>$${item.subtotal.toFixed(2)}</td>
                    <td><button type="button" class="btn-danger" onclick="quitarProductoDeCesta(${idx})">Quitar</button></td>
                </tr>
            `;
        });
    }
    const totalBox = document.getElementById('cesta-total');
    if (totalBox) totalBox.innerText = `$${total.toFixed(2)}`;
}

function quitarProductoDeCesta(index) {
    cestaActual.splice(index, 1);
    guardarCestaLocal();
    renderizarCesta();
}

function isProductLiked(productId) {
    return likes.some(like => like.productId === productId);
}

async function cargarLikes() {
    if (!authState.user) {
        likes = [];
        renderizarMegusta();
        return;
    }
    try {
        const response = await fetch('/api/likes', { credentials: 'include' });
        const data = await response.json();
        if (response.ok && data.status === 'success') {
            likes = data.likes.map(like => ({ productId: like.productId, isPublic: Boolean(like.isPublic) }));
            renderizarMegusta();
            return;
        }
    } catch (err) {
        console.warn('No se pudo cargar los likes', err);
    }
    likes = [];
    renderizarMegusta();
}

async function toggleLike(productId) {
    if (!authState.user) {
        showNotification('Inicia sesión para guardar productos favoritos', 'error');
        return;
    }
    const liked = isProductLiked(productId);
    try {
        const response = await fetch(liked ? `/api/likes/${productId}` : '/api/likes', {
            method: liked ? 'DELETE' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: liked ? undefined : JSON.stringify({ productId, isPublic: true })
        });
        const data = await response.json();
        if (!response.ok) {
            showNotification(data.message || 'No se pudo actualizar el like', 'error');
            return;
        }
        await cargarLikes();
        filtrarTienda();
        showNotification(liked ? 'Producto removido de Me gusta' : 'Producto guardado en Me gusta');
    } catch (err) {
        showNotification('Error de conexión con el servidor', 'error');
    }
}

async function cambiarPrivacidadLike(productId, isPublic) {
    try {
        const response = await fetch(`/api/likes/${productId}/privacy`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ isPublic })
        });
        const data = await response.json();
        if (!response.ok) {
            showNotification(data.message || 'No se pudo actualizar la privacidad', 'error');
            return;
        }
        await cargarLikes();
        renderizarMegusta();
        showNotification('Privacidad actualizada');
    } catch (err) {
        showNotification('Error de conexión con el servidor', 'error');
    }
}

function renderizarMegusta() {
    const contenedor = document.getElementById('megusta-grid');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    const likedProducts = productos.filter(p => isProductLiked(p.id));
    if (likedProducts.length === 0) {
        contenedor.innerHTML = `<p style="color:var(--text-dark-muted); text-align:center; width:100%;">No tienes productos guardados en Me gusta aún.</p>`;
        return;
    }
    likedProducts.forEach(prod => {
        const isPublic = likes.find(l => l.productId === prod.id)?.isPublic;
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img class="product-img" src="${prod.imagen || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500'}" alt="${prod.nombre}">
            <div class="product-title">${prod.nombre}</div>
            <div class="product-meta">${prod.categoria} • $${prod.precio.toFixed(2)}</div>
            <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <button class="btn-like ${isPublic ? 'liked' : ''}" onclick="toggleLike(${prod.id})">${isPublic ? '❤️' : '🤍'}</button>
                <label style="color:var(--text-dark-muted); font-size:13px;">
                    <input type="checkbox" ${isPublic ? 'checked' : ''} onchange="cambiarPrivacidadLike(${prod.id}, this.checked)"> Público
                </label>
            </div>
        `;
        contenedor.appendChild(card);
    });
}

async function buscarUsuarioAdmin(event) {
    event.preventDefault();
    const username = document.getElementById('admin-search-username').value.trim();
    if (!username) return;
    try {
        const response = await fetch(`/api/admin/users?username=${encodeURIComponent(username)}`, { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) {
            showNotification(data.message || 'No se encontró el usuario', 'error');
            return;
        }
        renderizarAdminUserDetail(data.user, data.publicLikes || []);
    } catch (err) {
        showNotification('Error de conexión con el servidor', 'error');
    }
}

function renderizarAdminUserDetail(user, likesList) {
    const container = document.getElementById('admin-user-detail');
    if (!container) return;
    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="admin-detail-card">
            <div style="display:flex; align-items:center; gap:16px; margin-bottom:18px;">
                <img src="${user.photoUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100'}" alt="${user.fullName}" style="width:72px; height:72px; border-radius:50%; object-fit:cover; border:1px solid rgba(255,255,255,0.08);" />
                <div>
                    <h3 style="margin:0 0 6px 0;">${user.fullName} (@${user.username})</h3>
                    <p style="margin:0; color:var(--text-dark-muted);">Teléfono: ${user.phone || 'No registrado'}</p>
                    <p style="margin:4px 0 0 0; color:var(--text-dark-muted);">Rol actual: <strong>${user.role}</strong></p>
                </div>
            </div>
            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:18px;">
                <button class="btn-secondary-neon" onclick="promoverUsuarioAdmin(${user.id}, 'admin')">Hacer Administrador</button>
                <button class="btn-secondary-neon" onclick="promoverUsuarioAdmin(${user.id}, 'customer')">Hacer Cliente</button>
            </div>
            <div>
                <h4 style="margin-bottom:12px;">Likes públicos</h4>
                <div class="products-grid" id="admin-user-likes">
                    ${likesList.length === 0 ? '<p style="color:var(--text-dark-muted);">Este usuario no tiene likes públicos.</p>' : likesList.map(prod => `
                        <div class="product-card">
                            <img class="product-img" src="${prod.image || prod.imagen || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500'}" alt="${prod.name || prod.nombre}">
                            <div class="product-title">${prod.name || prod.nombre}</div>
                            <div class="product-meta">${prod.category || prod.categoria} • $${Number(prod.price ?? prod.precio).toFixed(2)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

async function promoverUsuarioAdmin(userId, role) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ role })
        });
        const data = await response.json();
        if (!response.ok) {
            showNotification(data.message || 'No se pudo cambiar el rol', 'error');
            return;
        }
        showNotification('Rol actualizado correctamente');
        renderizarAdminUserDetail(data.user, []);
    } catch (err) {
        showNotification('Error de conexión con el servidor', 'error');
    }
}

async function cargarProductos() {
    try {
        const response = await fetch('/api/products', { credentials: 'include' });
        const data = await response.json();
        if (response.ok && data.status === 'success') {
            productos = (data.products || productosFallback).map(normalizarProducto);
            await cargarLikes();
            filtrarTienda();
            renderizarProductosDeSeccion();
            inicializarSelectorProductos();
            actualizarEstadisticasInicio();
            return;
        }
        throw new Error(data.message || data.error || 'Error al cargar productos');
    } catch (err) {
        console.warn('No se pudo cargar productos desde el backend', err);
    }
    productos = productosFallback.map(normalizarProducto);
    await cargarLikes();
    filtrarTienda();
    renderizarProductosDeSeccion();
    inicializarSelectorProductos();
    actualizarEstadisticasInicio();
}

function filtrarTienda() {
    const busqueda = document.getElementById('tienda-busqueda')?.value.toLowerCase() || '';
    const categoriaFilter = document.getElementById('tienda-categoria')?.value || '';
    const filtrados = productos.filter(p => {
        const texto = `${p.nombre} ${p.categoria}`.toLowerCase();
        return texto.includes(busqueda) && (categoriaFilter ? p.categoria === categoriaFilter : true);
    });
    renderizarTiendaProductos(filtrados);
}

function renderizarTiendaProductos(lista) {
    const contenedor = document.getElementById('tienda-productos-grid');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    if (lista.length === 0) {
        contenedor.innerHTML = `<div class="client-empty-message">No se encontraron productos con esos filtros.</div>`;
        return;
    }

    lista.forEach(prod => {
        const liked = isProductLiked(prod.id);
        const card = document.createElement('div');
        card.className = 'client-card';
        card.innerHTML = `
            <img src="${prod.imagen || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500'}" alt="${prod.nombre}" />
            <div class="client-card-content">
                <div class="card-like-row" style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                    <h3 style="margin:0; font-size:1.05rem;">${prod.nombre}</h3>
                    <button type="button" class="btn-like ${liked ? 'liked' : ''}" onclick="toggleLike(${prod.id})" title="Agregar a favoritos" aria-label="Agregar ${prod.nombre} a favoritos">${liked ? '❤️' : '🤍'}</button>
                </div>
                <p>${prod.categoria} • Stock: ${prod.stock}</p>
                <div class="product-price">$${Number(prod.precio).toFixed(2)}</div>
                <select id="variant-${prod.id}">
                    <option value="Default">Personalización estándar</option>
                    <option value="Grabado láser">Grabado láser</option>
                    <option value="Acabado mate">Acabado mate</option>
                    <option value="Estuche premium">Estuche premium</option>
                </select>
                <div class="product-actions">
                    <div style="display:flex; gap:10px;">
                        <input type="number" min="1" max="${prod.stock}" value="1" id="tienda-qty-${prod.id}" style="width:70px;" />
                        <button class="btn-add-cart" onclick="agregarProductoAlPedidoDesdeTienda(${prod.id}, 'tienda-qty-${prod.id}')">Agregar</button>
                    </div>
                </div>
            </div>
        `;
        contenedor.appendChild(card);
    });
}

async function agregarProductoAlPedidoDesdeTienda(productId, qtyInputId = `qty-${productId}`) {
    const cantidad = parseInt(document.getElementById(qtyInputId)?.value, 10) || 1;
    const prod = productos.find(p => p.id === productId);
    if (!prod) {
        showNotification('Producto no encontrado', 'error');
        return;
    }
    if (cantidad > prod.stock) {
        showNotification('No hay suficiente stock para esa cantidad', 'error');
        return;
    }
    const existe = cestaActual.find(c => c.idProducto === productId);
    if (existe) {
        if (existe.cantidad + cantidad > prod.stock) {
            showNotification('Supera el stock disponible', 'error');
            return;
        }
        existe.cantidad += cantidad;
        existe.subtotal = existe.cantidad * existe.precioUnitario;
    } else {
        cestaActual.push({
            idProducto: prod.id,
            nombre: prod.nombre,
            precioUnitario: prod.precio,
            cantidad,
            subtotal: prod.precio * cantidad
        });
    }
    guardarCestaLocal();
    renderizarCesta();
    showNotification('Producto agregado a la cesta');
}

async function cargarUsuarioActual() {
    try {
        const res = await fetch('/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (data.status === 'success' && data.user) {
            authState.user = data.user;
            mostrarApp();
        } else {
            mostrarAuth();
        }
    } catch (error) {
        mostrarAuth();
    }
}

function mostrarAuth() {
    authSelectors.authScreen.classList.remove('hidden');
    authSelectors.appContainer.classList.add('hidden');
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
}

async function mostrarApp() {
    authSelectors.authScreen.classList.add('hidden');
    authSelectors.appContainer.classList.remove('hidden');
    refreshUserProfile();
    updateMenuForRole();
    cargarCestaLocal();
    cargarNotificacionesLocal();
    cargarProductos();
    // Start polling notifications for admins so all admins see requests promptly
    if (authState.user?.role === 'admin') {
        if (notificacionesPolling) clearInterval(notificacionesPolling);
        notificacionesPolling = setInterval(cargarNotificacionesLocal, 5000);
    } else {
        if (notificacionesPolling) { clearInterval(notificacionesPolling); notificacionesPolling = null; }
    }
    if (authState.user.role === 'admin') {
        await cargarOrdenes();
    }
    cambiarPestana('inicio');
}

function mostrarAuthSection(section) {
    const loginButton = document.getElementById('btn-login-switch');
    const registerButton = document.getElementById('btn-register-switch');
    if (section === 'register') {
        authSelectors.loginSection.classList.remove('active');
        authSelectors.registerSection.classList.add('active');
        loginButton.classList.remove('active');
        registerButton.classList.add('active');
    } else {
        authSelectors.loginSection.classList.add('active');
        authSelectors.registerSection.classList.remove('active');
        loginButton.classList.add('active');
        registerButton.classList.remove('active');
    }
}

async function submitLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const loginError = document.getElementById('login-error');
    loginError.textContent = '';

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        if (!response.ok) {
            loginError.textContent = result.error || 'Error al iniciar sesión';
            return;
        }
        authState.user = result.user;
        mostrarApp();
    } catch (err) {
        loginError.textContent = 'Error de conexión. Intenta nuevamente.';
    }
}

async function submitRegister(event) {
    event.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const fullName = document.getElementById('register-fullname').value.trim();
    const password = document.getElementById('register-password').value;
    const photoUrl = document.getElementById('register-photo').value.trim();
    const registerError = document.getElementById('register-error');
    registerError.textContent = '';

    try {
        const phone = document.getElementById('register-phone').value.trim();
        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, fullName, password, photoUrl, phone })
        });
        const result = await response.json();
        if (!response.ok) {
            registerError.textContent = result.error || 'Error al crear cuenta';
            return;
        }
        authState.user = result.user;
        mostrarApp();
    } catch (err) {
        registerError.textContent = 'Error de conexión. Intenta nuevamente.';
    }
}

async function logout() {
    try {
        await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (_) {
        // ignore
    }
    authState.user = null;
    mostrarAuth();
}

function refreshUserProfile() {
    if (!authState.user) return;
    const profilePhoto = document.getElementById('profile-photo');
    const profileName = document.getElementById('profile-name');
    profilePhoto.src = authState.user.photoUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100';
    profileName.textContent = authState.user.fullName || authState.user.username;

    if (authSelectors.profileUsername) authSelectors.profileUsername.value = authState.user.username;
    if (authSelectors.profileFullName) authSelectors.profileFullName.value = authState.user.fullName || '';
    if (authSelectors.profilePhoto) authSelectors.profilePhoto.value = authState.user.photoUrl || '';
    if (authSelectors.profilePhone) authSelectors.profilePhone.value = authState.user.phone || '';
}

function updateMenuForRole() {
    const isAdmin = authState.user?.role === 'admin';
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
    document.querySelectorAll('.customer-only').forEach(el => el.classList.toggle('hidden', isAdmin));
    document.querySelectorAll('.user-only').forEach(el => el.classList.toggle('hidden', !authState.user));
}

function toggleProfileEditor() {
    authSelectors.profileEditor.classList.toggle('hidden');
}

async function guardarPerfil(event) {
    event.preventDefault();
    const username = authSelectors.profileUsername.value.trim();
    const fullName = authSelectors.profileFullName.value.trim();
    const photoUrl = authSelectors.profilePhoto.value.trim();
    const profileError = document.getElementById('profile-error');
    profileError.textContent = '';

    try {
        const response = await fetch('/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, fullName, photoUrl })
        });
        const result = await response.json();
        if (!response.ok) {
            profileError.textContent = result.error || 'No se pudo actualizar el perfil';
            return;
        }
        authState.user = result.user;
        refreshUserProfile();
        toggleProfileEditor();
    } catch (err) {
        profileError.textContent = 'Error de conexión. Intenta nuevamente.';
    }
}

// --- ENGINE DE FOTOS ANIMADAS FLOTANDO EN EL FONDO ---
function generarFondoAnimado(categoriaOApartado) {
    const contenedor = document.getElementById('animated-bg-overlay');
    contenedor.innerHTML = ""; // Limpiar fotos viejas
    elementosFlotantes = [];
    if (loopAnimacionFondo) cancelAnimationFrame(loopAnimacionFondo);

    // Obtener pool de fotos representativas
    let bancoImagenes = [];
    if(metadatosSecciones[categoriaOApartado]) {
        // Si es una sección de mercancía, buscar fotos de sus productos reales
        bancoImagenes = productos.filter(p => p.categoria === categoriaOApartado).map(p => p.imagen);
    }
    
    // Si faltan imágenes o es un apartado administrativo, rellenamos con imágenes por defecto
    if(bancoImagenes.length < 3) {
        bancoImagenes = [
            "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400",
            "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400",
            "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400",
            "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400"
        ];
    }

    const cantidadFotos = 8; // Número de fotos flotando simultáneamente
    for (let i = 0; i < cantidadFotos; i++) {
        const imgUrl = bancoImagenes[i % bancoImagenes.length];
        const imgNode = document.createElement('img');
        imgNode.src = imgUrl || "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400";
        imgNode.className = "floating-bg-item";
        contenedor.appendChild(imgNode);

        // Crear modelo de datos físicos para moverlos por la pantalla
        elementosFlotantes.push({
            el: imgNode,
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            velX: (Math.random() - 0.5) * 0.8, // Velocidad en eje X
            velY: (Math.random() - 0.5) * 0.8, // Velocidad en eje Y
            rotacion: Math.random() * 360,
            velRotacion: (Math.random() - 0.5) * 0.2,
            ancho: 120,
            alto: 120
        });
    }

    actualizarFisicasFondo();
}

function actualizarFisicasFondo() {
    elementosFlotantes.forEach(item => {
        // Aplicar movimiento continuo
        item.x += item.velX;
        item.y += item.velY;
        item.rotacion += item.velRotacion;

        // Rebotar en los límites horizontales de la pantalla
        if (item.x < -item.ancho) item.x = window.innerWidth;
        if (item.x > window.innerWidth) item.x = -item.ancho;
        
        // Rebotar en los límites verticales de la pantalla
        if (item.y < -item.alto) item.y = window.innerHeight;
        if (item.y > window.innerHeight) item.y = -item.alto;

        // Aplicar transformaciones visuales por CSS
        item.el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0) rotate(${item.rotacion}deg)`;
    });

    loopAnimacionFondo = requestAnimationFrame(actualizarFisicasFondo);
}

// --- MANEJO DE VISTAS Y SUBMENÚS ---
function toggleDropdown(idDropdown) {
    const elemento = document.getElementById(idDropdown);
    const estaAbierto = elemento.classList.contains('show');
    cerrarTodosLosDropdowns();
    if (!estaAbierto) elemento.classList.add('show');
}

function cerrarTodosLosDropdowns() {
    document.querySelectorAll('.dropdown-content').forEach(drop => drop.classList.remove('show'));
}

function ejecutarAccionSeccion(nombreSeccion) {
    cerrarTodosLosDropdowns();
    irASeccion(nombreSeccion);
}

function ejecutarAccionPestana(idPestana) {
    cerrarTodosLosDropdowns();
    cambiarPestana(idPestana);
}

function cambiarPestana(idPestana) {
    const isAdmin = authState.user?.role === 'admin';
    if ((idPestana === 'historial' || idPestana === 'notificaciones') && !isAdmin) {
        showNotification('Esta sección solo está disponible para administradores', 'error');
        return;
    }

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`pestana-${idPestana}`).classList.add('active');
    
    if(idPestana === 'pedidos') inicializarSelectorProductos();
    if(idPestana === 'historial') cargarOrdenes();
    if(idPestana === 'notificaciones') renderizarNotificaciones();
    
    // Cambiar la temática del fondo animado según el apartado
    generarFondoAnimado(idPestana);
}

function irASeccion(nombreCategoria) {
    seccionActiva = nombreCategoria;

    const banner = document.getElementById('banner-representativo');
    banner.style.backgroundImage = metadatosSecciones[nombreCategoria].img;
    document.getElementById('titulo-seccion-actual').innerText = metadatosSecciones[nombreCategoria].titulo;
    document.getElementById('descripcion-seccion-actual').innerText = metadatosSecciones[nombreCategoria].desc;

    renderizarProductosDeSeccion();
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById('pestana-secciones').classList.add('active');
    
    // Ejecutar fondo dinámico centrado en la categoría elegida
    generarFondoAnimado(nombreCategoria);
}

function actualizarEstadisticasInicio() {
    document.getElementById('stat-total-productos').innerText = productos.length;
    document.getElementById('stat-total-pedidos').innerText = pedidos.length;
    const ingresos = pedidos.reduce((acc, p) => acc + p.total, 0);
    document.getElementById('stat-ingresos-totales').innerText = `$${ingresos.toFixed(2)}`;
}

// --- INVENTARIO DE PRODUCTOS ---
function renderizarProductosDeSeccion() {
    const contenedor = document.getElementById('contenedor-productos-seccion');
    contenedor.innerHTML = "";
    const filtrados = productos.filter(p => p.categoria === seccionActiva);

    if(filtrados.length === 0) {
        contenedor.innerHTML = `<p style="grid-column:1/-1; color:var(--text-dark-muted); text-align:center; padding:30px;">No has agregado mercancía en esta sección todavía.</p>`;
        return;
    }

    filtrados.forEach(prod => {
        const estReal = prod.stock <= 0 ? "Agotado" : prod.estado;
        const liked = isProductLiked(prod.id);
        const card = document.createElement('div');
        card.className = "product-card";
        card.innerHTML = `
            <span class="badge ${estReal.toLowerCase()}">${estReal}</span>
            <img class="product-img" src="${prod.imagen || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500'}" alt="${prod.nombre}">
            <div class="product-header-row" style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:10px;">
                <div>
                    <div class="product-title">${prod.nombre}</div>
                    <div class="product-meta">Unidades en Caja: <b style="color:white">${prod.stock}</b></div>
                </div>
                <button class="btn-like user-only hidden ${liked ? 'liked' : ''}" onclick="toggleLike(${prod.id})" title="${liked ? 'Quitar de Me gusta' : 'Agregar a Me gusta'}">${liked ? '❤️' : '🤍'}</button>
            </div>
            <div class="product-price">$${Number(prod.precio).toFixed(2)}</div>
            <div class="form-actions" style="margin-top: 15px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                <div class="user-only hidden" style="display:flex; gap:10px; align-items:center; flex:1;">
                    <input type="number" id="section-qty-${prod.id}" min="1" max="${prod.stock}" value="1" style="width:70px; padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); background:var(--bg-dark-input); color:var(--text-main);" ${prod.stock <= 0 ? 'disabled' : ''} />
                    <button type="button" class="btn-add-cart" onclick="agregarProductoAlPedidoDesdeTienda(${prod.id}, 'section-qty-${prod.id}')" ${prod.stock <= 0 ? 'disabled' : ''}>Agregar a la cesta</button>
                </div>
                <div class="form-actions" style="display:flex; gap:10px;">
                    <button class="btn-secondary-neon admin-only hidden" style="padding:6px 12px; font-size:12px; flex:1;" onclick="cargarProductoParaEditar(${prod.id})">⚙️ Editar</button>
                    <button class="btn-danger admin-only hidden" style="padding:6px 12px; font-size:12px;" onclick="eliminarProducto(${prod.id})">Eliminar</button>
                </div>
            </div>
        `;
        contenedor.appendChild(card);
    });
    updateMenuForRole();
}

async function guardarProducto(e) {
    e.preventDefault();
    const idExistente = document.getElementById('edit-prod-id').value;
    const nombre = document.getElementById('prod-nombre').value.trim();
    const categoria = document.getElementById('prod-categoria').value;
    const precio = parseFloat(document.getElementById('prod-precio').value);
    const stock = parseInt(document.getElementById('prod-stock').value, 10);
    let imagen = document.getElementById('prod-imagen').value.trim();

    if (imagenBase64Temporal && imagen.includes("Imagen local cargada")) {
        imagen = imagenBase64Temporal;
    }

    if (!nombre || isNaN(precio) || isNaN(stock)) {
        showNotification('Completa todos los campos del producto', 'error');
        return;
    }

    try {
        const payload = { name: nombre, category: categoria, price: precio, stock, image: imagen };
        let response;
        if (idExistente) {
            response = await fetch(`/api/products/${idExistente}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
        }
        const result = await response.json();
        if (!response.ok) {
            showNotification(result.message || 'Error guardando el producto', 'error');
            return;
        }
        showNotification('Producto guardado correctamente');
        limpiarFormularioProducto();
        cargarProductos();
        if (idExistente) irASeccion(categoria);
    } catch (err) {
        showNotification('Error de conexión con el servidor', 'error');
    }
}

function convertirImagenBase64() {
    const archivo = document.getElementById('prod-file').files[0];
    if (archivo) {
        const lector = new FileReader();
        lector.onloadend = () => {
            imagenBase64Temporal = lector.result;
            document.getElementById('prod-imagen').value = "Imagen local cargada exitosamente.";
        };
        lector.readAsDataURL(archivo);
    }
}

function cargarProductoParaEditar(id) {
    const prod = productos.find(p => p.id === id);
    if(!prod) return;

    document.getElementById('edit-prod-id').value = prod.id;
    document.getElementById('prod-nombre').value = prod.nombre;
    document.getElementById('prod-categoria').value = prod.categoria;
    document.getElementById('prod-precio').value = prod.precio;
    document.getElementById('prod-stock').value = prod.stock;
    document.getElementById('prod-imagen').value = prod.imagen.startsWith('data:image') ? "Imagen local cargada." : prod.imagen;
    
    document.getElementById('formulario-producto-titulo').innerText = "Modificar Atributos de Mercancía";
    cambiarPestana('nuevo-producto');
}

async function eliminarProducto(id) {
    try {
        const response = await fetch(`/api/products/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const result = await response.json();
        if (!response.ok) {
            showNotification(result.message || 'No se pudo eliminar el producto', 'error');
            return;
        }
        showNotification('Producto eliminado correctamente');
        cargarProductos();
    } catch (err) {
        showNotification('Error de conexión con el servidor', 'error');
    }
}

function limpiarFormularioProducto() {
    document.getElementById('form-producto').reset();
    document.getElementById('edit-prod-id').value = "";
    imagenBase64Temporal = "";
    document.getElementById('formulario-producto-titulo').innerText = "Agregar Artículo al Sistema";
}

// --- PROCESADOR DE ORDENES ---
function configurarFechaActual() {
    document.getElementById('ped-fecha').value = new Date().toISOString().split('T')[0];
}

function inicializarSelectorProductos() {
    const select = document.getElementById('ped-select-producto');
    select.innerHTML = "";
    const activos = productos.filter(p => p.stock > 0);
    
    if(activos.length === 0) {
        select.innerHTML = "<option value=''>Sin stock disponible</option>";
        return;
    }
    activos.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.nombre} ($${p.precio.toFixed(2)}) [${p.categoria}]</option>`;
    });
    actualizarMaximoStock();
}

function actualizarMaximoStock() {
    const idSel = document.getElementById('ped-select-producto').value;
    if(!idSel) return;
    const prod = productos.find(p => p.id == idSel);
    if(prod) {
        document.getElementById('stock-disponible-label').innerText = `Stock físico actual: ${prod.stock} unidades.`;
        document.getElementById('ped-cantidad').max = prod.stock;
    }
}

function agregarProductoAlPedido() {
    const idSel = document.getElementById('ped-select-producto').value;
    const cantidad = parseInt(document.getElementById('ped-cantidad').value, 10);
    if(!idSel) return;

    const prod = productos.find(p => p.id == idSel);
    if(cantidad > prod.stock) {
        showNotification('Supera el stock disponible', 'error');
        return;
    }

    const existe = carritoActual.find(c => c.idProducto == idSel);
    if(existe) {
        if((existe.cantidad + cantidad) > prod.stock) {
            showNotification('Suma total supera existencias', 'error');
            return;
        }
        existe.cantidad += cantidad;
        existe.subtotal = existe.cantidad * existe.precioUnitario;
    } else {
        carritoActual.push({
            idProducto: prod.id,
            nombre: prod.nombre,
            precioUnitario: prod.precio,
            cantidad: cantidad,
            subtotal: prod.precio * cantidad
        });
    }
    renderizarCarrito();
}

function renderizarCarrito() {
    const tbody = document.getElementById('lista-articulos-pedido');
    tbody.innerHTML = "";
    let total = 0;
    carritoActual.forEach((item, idx) => {
        total += item.subtotal;
        tbody.innerHTML += `
            <tr>
                <td>${item.nombre}</td>
                <td>$${item.precioUnitario.toFixed(2)}</td>
                <td>${item.cantidad}</td>
                <td>$${item.subtotal.toFixed(2)}</td>
                <td><button type="button" class="btn-danger" onclick="carritoActual.splice(${idx},1); renderizarCarrito();">X</button></td>
            </tr>
        `;
    });
    document.getElementById('pedido-total-dinamico').innerText = `$${total.toFixed(2)}`;
}

async function guardarPedido(e) {
    e.preventDefault();
    if (carritoActual.length === 0) {
        showNotification('Agrega ítems al carrito antes de registrar la orden', 'error');
        return;
    }

    const customerName = document.getElementById('ped-cliente').value.trim();
    const phone = document.getElementById('ped-telefono').value.trim();
    const instagram = document.getElementById('ped-instagram').value.trim();
    const date = document.getElementById('ped-fecha').value;
    const status = document.getElementById('ped-estado').value;
    const total = carritoActual.reduce((acc, c) => acc + c.subtotal, 0);

    if (!customerName) {
        showNotification('Escribe el nombre del cliente', 'error');
        return;
    }

    const payload = { customerName, phone, instagram, date, status, total };
    if (solicitudPedidoActual) payload.requestId = solicitudPedidoActual;
    registrarOrdenBackend(payload, carritoActual);
}

async function registrarOrdenBackend(orderData, orderItems = carritoActual) {
    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                ...orderData,
                items: orderItems.map(item => ({
                    productId: item.idProducto,
                    quantity: item.cantidad,
                    price: item.precioUnitario
                }))
            })
        });
        const result = await response.json();
        if (!response.ok) {
            showNotification(result.message || 'Error al registrar la orden', 'error');
            return;
        }

        showNotification('Orden registrada correctamente');
        if (solicitudPedidoActual) {
            solicitudPedidoActual = null;
            // refresh admin notifications from server
            await cargarNotificacionesLocal();
        }
        carritoActual = [];
        if (orderItems === cestaActual) {
            cestaActual = [];
            guardarCestaLocal();
        }
        document.getElementById('form-pedido').reset();
        renderizarCarrito();
        renderizarCesta();
        configurarFechaActual();
        await cargarProductos();
        if (authState.user?.role === 'admin') {
            await cargarOrdenes();
            cambiarPestana('historial');
        } else {
            cambiarPestana('inicio');
        }
    } catch (err) {
        showNotification('Error de conexión con el servidor', 'error');
    }
}

async function cargarOrdenes() {
    try {
        const response = await fetch('/api/orders', { credentials: 'include' });
        const data = await response.json();
        if (response.ok && data.status === 'success') {
            pedidos = data.orders || [];
            renderizarHistorialPedidos();
            actualizarEstadisticasInicio();
            return;
        }
        throw new Error(data.message || data.error || 'Error al cargar las órdenes');
    } catch (err) {
        console.warn('No se pudo cargar las órdenes', err);
    }
    pedidos = [];
    renderizarHistorialPedidos();
    actualizarEstadisticasInicio();
}

// --- HISTORIAL GENERAL ---
function renderizarHistorialPedidos() {
    const tbody = document.getElementById('historial-pedidos-body');
    tbody.innerHTML = "";

    if (pedidos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dark-muted);">No hay órdenes registradas.</td></tr>`;
        return;
    }

    pedidos.forEach(ped => {
        const itemsStr = (ped.items || []).map(item => `${item.quantity}x producto #${item.product_id}`).join('<br>');
        tbody.innerHTML += `
            <tr>
                <td>
                    <b style="font-size:15px; color:#fff;">${ped.customer_name || 'Cliente'}</b><br>
                    <span style="color:var(--neon-cyan); font-size:12px;">📞 ${ped.phone || 'Sin tel'}</span> | 
                    <span style="color:var(--neon-pink); font-size:12px;">📸 ${ped.instagram || 'Sin IG'}</span>
                </td>
                <td>${ped.date || 'N/A'}</td>
                <td>
                    <b style="color:var(--neon-green); font-size:15px;">$${Number(ped.total || 0).toFixed(2)}</b><br>
                    <span style="font-size:11px; color:var(--text-dark-muted);">${itemsStr}</span>
                </td>
                <td>${ped.status || 'Pendiente'}</td>
                <td><span class="badge ${ped.status === 'Entregado' ? 'disponible' : 'agotado'}">${ped.status || 'Pendiente'}</span></td>
                <td><button class="btn-danger" style="padding: 5px 10px;" onclick="eliminarOrden(${ped.id})">🗑️</button></td>
            </tr>
        `;
    });
}

// TODO: historic order state transitions now managed server-side.
// Kept locally only for compatibility; not used in current flow.
function cambiarEstadoPedidoEnCaliente(idPedido, nuevoEstado) {
    console.warn('Cambio de estado en caliente deshabilitado para órdenes administradas por servidor');
}

function actualizarTiempoEntrega(idPedido, campo, valor) {
    console.warn('Actualización de entrega deshabilitada para órdenes administradas por servidor');
}

async function eliminarOrden(id) {
    try {
        const response = await fetch(`/api/orders/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const result = await response.json();
        if (!response.ok) {
            showNotification(result.message || 'No se pudo eliminar la orden', 'error');
            return;
        }
        showNotification('Orden eliminada');
        await cargarOrdenes();
    } catch (err) {
        showNotification('Error de conexión con el servidor', 'error');
    }
}

async function convertirSolicitudRapida(idSolicitud) {
    const solicitud = notificacionesPedidos.find(item => item.id === idSolicitud);
    if (!solicitud) {
        showNotification('Solicitud no encontrada', 'error');
        return;
    }
    // build order items in the format expected by registrarOrdenBackend
    const orderItems = (solicitud.items || []).map(i => ({ idProducto: i.idProducto, cantidad: i.cantidad, precioUnitario: i.precioUnitario }));
    const payload = {
        customerName: solicitud.customerName,
        phone: solicitud.phone || '',
        instagram: solicitud.instagram || '',
        date: new Date().toISOString().split('T')[0],
        status: 'Pendiente',
        total: solicitud.amount || orderItems.reduce((s, it) => s + (Number(it.precioUnitario || 0) * Number(it.cantidad || 1)), 0),
        requestId: solicitud.id
    };
    // call existing backend order registrar which will delete the request
    await registrarOrdenBackend(payload, orderItems);
}