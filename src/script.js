// --- BASE DE DATOS LOCALPERSISTENTE ---
let productos = JSON.parse(localStorage.getItem('productos_neon')) || [
    { id: 1, nombre: "Anillo de Garra Dragón", categoria: "Anillos", precio: 350.00, stock: 15, estado: "Disponible", imagen: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500" },
    { id: 2, nombre: "Collares Compartidos Yin Yang", categoria: "Collares", precio: 450.00, stock: 5, estado: "Disponible", imagen: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500" },
    { id: 3, nombre: "Pulsera de Cuero Ajustable", categoria: "Pulseras", precio: 250.00, stock: 22, estado: "Disponible", imagen: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=500" },
    { id: 4, nombre: "Poster Hunter x Hunter - Killua", categoria: "Posters Anime", precio: 180.00, stock: 10, estado: "Disponible", imagen: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500" }
];

let pedidos = JSON.parse(localStorage.getItem('pedidos_neon')) || [];
let carritoActual = [];
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

document.addEventListener('DOMContentLoaded', () => {
    configurarFechaActual();
    authSelectors.authScreen = document.getElementById('auth-screen');
    authSelectors.appContainer = document.querySelector('.app-container');
    authSelectors.loginSection = document.getElementById('auth-login');
    authSelectors.registerSection = document.getElementById('auth-register');
    authSelectors.profileEditor = document.getElementById('profile-editor-panel');
    authSelectors.profileUsername = document.getElementById('profile-username-edit');
    authSelectors.profileFullName = document.getElementById('profile-fullname-edit');
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
    localStorage.setItem('productos_neon', JSON.stringify(productos));
    localStorage.setItem('pedidos_neon', JSON.stringify(pedidos));
    actualizarEstadisticasInicio();
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

function mostrarApp() {
    authSelectors.authScreen.classList.add('hidden');
    authSelectors.appContainer.classList.remove('hidden');
    actualizarEstadisticasInicio();
    refreshUserProfile();
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
        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, fullName, password, photoUrl })
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
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`pestana-${idPestana}`).classList.add('active');
    
    if(idPestana === 'pedidos') inicializarSelectorProductos();
    if(idPestana === 'historial') renderizarHistorialPedidos();
    
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
        const card = document.createElement('div');
        card.className = "product-card";
        card.innerHTML = `
            <span class="badge ${estReal.toLowerCase()}">${estReal}</span>
            <img class="product-img" src="${prod.imagen || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500'}" alt="${prod.nombre}">
            <div class="product-title">${prod.nombre}</div>
            <div class="product-meta">Unidades en Caja: <b style="color:white">${prod.stock}</b></div>
            <div class="product-price">$${Number(prod.precio).toFixed(2)}</div>
            <div class="form-actions" style="margin-top: 15px; display:flex; gap:10px;">
                <button class="btn-secondary-neon" style="padding:6px 12px; font-size:12px; flex:1;" onclick="cargarProductoParaEditar(${prod.id})">⚙️ Editar</button>
                <button class="btn-danger" style="padding:6px 12px; font-size:12px;" onclick="eliminarProducto(${prod.id})">Eliminar</button>
            </div>
        `;
        contenedor.appendChild(card);
    });
}

function guardarProducto(e) {
    e.preventDefault();
    const idExistente = document.getElementById('edit-prod-id').value;
    const nombre = document.getElementById('prod-nombre').value;
    const categoria = document.getElementById('prod-categoria').value;
    const precio = parseFloat(document.getElementById('prod-precio').value);
    const stock = parseInt(document.getElementById('prod-stock').value);
    let imagen = document.getElementById('prod-imagen').value;

    if(imagenBase64Temporal && imagen.includes("Imagen local cargada")) {
        imagen = imagenBase64Temporal;
    }

    const estado = stock > 0 ? "Disponible" : "Agotado";

    if(idExistente) {
        const index = productos.findIndex(p => p.id == idExistente);
        if(index !== -1) productos[index] = { ...productos[index], nombre, categoria, precio, stock, estado, imagen };
    } else {
        productos.push({ id: Date.now(), nombre, categoria, precio, stock, estado, imagen });
    }

    guardarDatos();
    limpiarFormularioProducto();
    irASeccion(categoria);
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

function eliminarProducto(id) {
    if(confirm("¿Eliminar artículo del inventario permanente?")) {
        productos = productos.filter(p => p.id !== id);
        guardarDatos();
        renderizarProductosDeSeccion();
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
    const cantidad = parseInt(document.getElementById('ped-cantidad').value);
    if(!idSel) return;

    const prod = productos.find(p => p.id == idSel);
    if(cantidad > prod.stock) return alert("Supera el stock disponible.");

    const existe = carritoActual.find(c => c.idProducto == idSel);
    if(existe) {
        if((existe.cantidad + cantidad) > prod.stock) return alert("Suma total supera existencias.");
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

function guardarPedido(e) {
    e.preventDefault();
    if(carritoActual.length === 0) return alert("Agrega ítems a la orden.");

    const estado = document.getElementById('ped-estado').value;
    const ahora = new Date();
    const horaPedido = ahora.toTimeString().split(' ')[0].substring(0,5);

    let fechaEntrega = null;
    let horaEntrega = null;
    if(estado === 'Entregado') {
        fechaEntrega = document.getElementById('ped-fecha').value;
        horaEntrega = horaPedido;
    }

    carritoActual.forEach(item => {
        const p = productos.find(prod => prod.id === item.idProducto);
        if(p) p.stock -= item.cantidad;
    });

    pedidos.unshift({
        id: Date.now(),
        cliente: document.getElementById('ped-cliente').value,
        contacto: { 
            telefono: document.getElementById('ped-telefono').value, 
            instagram: document.getElementById('ped-instagram').value 
        },
        articulos: [...carritoActual],
        total: carritoActual.reduce((acc, c) => acc + c.subtotal, 0),
        estado,
        fechaPedido: document.getElementById('ped-fecha').value,
        horaPedido: horaPedido,
        fechaEntrega,
        horaEntrega
    });

    guardarDatos();
    carritoActual = [];
    document.getElementById('form-pedido').reset();
    renderizarCarrito();
    configurarFechaActual();
    cambiarPestana('historial');
}

// --- HISTORIAL GENERAL ---
function renderizarHistorialPedidos() {
    const tbody = document.getElementById('historial-pedidos-body');
    tbody.innerHTML = "";

    if(pedidos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dark-muted);">No hay órdenes registradas.</td></tr>`;
        return;
    }

    pedidos.forEach(ped => {
        const itemsStr = ped.articulos.map(a => `${a.cantidad}x ${a.nombre}`).join('<br>');
        let bloqueTiemposEntrega = ped.estado === "Entregado" ? `
            <div class="time-editable-box" style="border-color: var(--neon-green)">
                <span style="color: var(--neon-green)">🟢 DESPACHADO:</span><br>
                Fecha: <input type="date" value="${ped.fechaEntrega || ped.fechaPedido}" onchange="actualizarTiempoEntrega(${ped.id}, 'fecha', this.value)"><br>
                Hora: <input type="time" value="${ped.horaEntrega || '12:00'}" onchange="actualizarTiempoEntrega(${ped.id}, 'hora', this.value)">
            </div>
        ` : `
            <div class="time-editable-box">
                <span style="color: var(--neon-pink)">❌ Sin entregar</span>
            </div>
        `;

        tbody.innerHTML += `
            <tr>
                <td>
                    <b style="font-size:15px; color:#fff;">${ped.cliente}</b><br>
                    <span style="color:var(--neon-cyan); font-size:12px;">📞 ${ped.contacto.telefono || 'Sin tel'}</span> | 
                    <span style="color:var(--neon-pink); font-size:12px;">📸 ${ped.contacto.instagram || 'Sin IG'}</span>
                </td>
                <td>
                    <b>${ped.fechaPedido}</b><br>
                    <span style="font-size:11px; color:var(--text-dark-muted);">Hora: ${ped.horaPedido || 'N/A'}hs</span>
                </td>
                <td>
                    <b style="color:var(--neon-green); font-size:15px;">$${ped.total.toFixed(2)}</b><br>
                    <span style="font-size:11px; color:var(--text-dark-muted);">${itemsStr}</span>
                </td>
                <td>
                    <select class="inline-select" onchange="cambiarEstadoPedidoEnCaliente(${ped.id}, this.value)">
                        <option value="Pendiente" ${ped.estado === 'Pendiente' ? 'selected' : ''}>🟡 Pendiente</option>
                        <option value="En Proceso" ${ped.estado === 'En Proceso' ? 'selected' : ''}>🔵 En Proceso</option>
                        <option value="Entregado" ${ped.estado === 'Entregado' ? 'selected' : ''}>🟢 Entregado</option>
                    </select>
                </td>
                <td>${bloqueTiemposEntrega}</td>
                <td><button class="btn-danger" style="padding: 5px 10px;" onclick="eliminarPedido(${ped.id})">🗑️</button></td>
            </tr>
        `;
    });
}

function cambiarEstadoPedidoEnCaliente(idPedido, nuevoEstado) {
    const ped = pedidos.find(p => p.id === idPedido);
    if(ped) {
        ped.estado = nuevoEstado;
        if(nuevoEstado === "Entregado") {
            ped.fechaEntrega = ped.fechaEntrega || new Date().toISOString().split('T')[0];
            ped.horaEntrega = ped.horaEntrega || new Date().toTimeString().split(' ')[0].substring(0,5);
        } else {
            ped.fechaEntrega = null;
            ped.horaEntrega = null;
        }
        guardarDatos();
        renderizarHistorialPedidos();
    }
}

function actualizarTiempoEntrega(idPedido, campo, valor) {
    const ped = pedidos.find(p => p.id === idPedido);
    if(ped) {
        if(campo === 'fecha') ped.fechaEntrega = valor;
        if(campo === 'hora') ped.horaEntrega = valor;
        guardarDatos();
    }
}

function eliminarPedido(id) {
    if(confirm("¿Eliminar registro definitivo de esta orden?")) {
        pedidos = pedidos.filter(p => p.id !== id);
        guardarDatos();
        renderizarHistorialPedidos();
    }
}