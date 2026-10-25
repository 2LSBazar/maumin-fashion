import { db, auth } from "./firebase-config.js";
import { SITE_CONFIG } from "./site-config.js";

let categories = [];
let products = [];
let editingProductId = null;
let productImages = [];
let colorData = [];
let sizeData = [];
let savingInProgress = false;
let bkashQrUrl = "";

// ---------- AUTH CHECK ----------
auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "admin-login.html";
  }
});

document.getElementById("logoutBtn").onclick = () => {
  auth.signOut().then(() => window.location.href = "admin-login.html");
};

// ---------- TABS ----------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  };
});

// ---------- CLOUDINARY UPLOAD HELPER ----------
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", SITE_CONFIG.cloudinaryUploadPreset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${SITE_CONFIG.cloudinaryCloudName}/image/upload`, {
    method: "POST",
    body: formData
  });
  const data = await res.json();
  return data.secure_url;
}

// ---------- WHATSAPP LINK HELPER ----------
function whatsappLink(phone, text) {
  let clean = (phone || "").replace(/\D/g, "");
  if (clean.startsWith("0")) clean = "88" + clean;
  if (!clean.startsWith("88")) clean = "88" + clean;
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

function formatDate(ts) {
  try {
    if (ts && ts.toDate) return ts.toDate().toLocaleString("bn-BD");
    if (ts instanceof Date) return ts.toLocaleString("bn-BD");
    return "";
  } catch (e) { return ""; }
}

// ================= CATEGORIES =================
async function loadCategories() {
  const snap = await db.collection("categories").get();
  categories = [];
  snap.forEach(doc => categories.push({ id: doc.id, ...doc.data() }));
  renderCategoriesTab();
}

function renderCategoriesTab() {
  const box = document.getElementById("categoriesList");
  if (categories.length === 0) {
    box.innerHTML = "<p>কোনো ক্যাটাগরি নেই।</p>";
    return;
  }
  box.innerHTML = categories.map(c => `
    <div class="list-row">
      <div style="flex:1;">${c.name}</div>
      <button class="btn-sm btn-red" onclick="deleteCategory('${c.id}')">মুছুন</button>
    </div>
  `).join("");
}

function renderCategoryCheckboxes(selectedIds = []) {
  const box = document.getElementById("pCategoryBox");
  if (categories.length === 0) {
    box.innerHTML = "<p style='font-size:13px;color:#888;'>আগে ক্যাটাগরি ট্যাবে গিয়ে ক্যাটাগরি যোগ করুন।</p>";
    return;
  }
  box.innerHTML = categories.map(c => `
    <label>
      <input type="checkbox" class="pCatCheck" value="${c.id}" ${selectedIds.includes(c.id) ? "checked" : ""}>
      ${c.name}
    </label>
  `).join("");
}

document.getElementById("addCategoryBtn").onclick = async () => {
  const input = document.getElementById("newCategoryInput");
  const name = input.value.trim();
  if (!name) return alert("ক্যাটাগরির নাম লিখুন");
  const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u0980-\u09FF-]/g, "");
  await db.collection("categories").doc(id || Date.now().toString()).set({ name });
  input.value = "";
  loadCategories();
};

window.deleteCategory = async (id) => {
  if (!confirm("এই ক্যাটাগরি মুছে ফেলতে চান?")) return;
  await db.collection("categories").doc(id).delete();
  loadCategories();
};

// ================= PRODUCTS =================
async function loadProducts() {
  const snap = await db.collection("products").get();
  products = [];
  snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
  renderProductsList();
}

function renderProductsList(filter = "") {
  const box = document.getElementById("productsList");
  let list = products;
  if (filter) {
    list = products.filter(p => (p.title || "").toLowerCase().includes(filter.toLowerCase()));
  }
  if (list.length === 0) {
    box.innerHTML = "<p>কোনো পণ্য পাওয়া যায়নি।</p>";
    return;
  }
  box.innerHTML = list.map(p => `
    <div class="list-row">
      <img src="${(p.images && p.images[0]) || ''}" alt="">
      <div style="flex:1;">
        <strong>${p.title || ''}</strong><br>
        <span>৳${p.regularPrice || 0} ${p.discountPrice ? ('/ ৳' + p.discountPrice) : ''}</span>
      </div>
      <div>
        <button class="btn-sm btn-gray" onclick="editProduct('${p.id}')">এডিট</button>
        <button class="btn-sm btn-red" onclick="deleteProduct('${p.id}')">মুছুন</button>
      </div>
    </div>
  `).join("");
}

document.getElementById("productSearchInput").addEventListener("input", (e) => {
  renderProductsList(e.target.value);
});

window.deleteProduct = async (id) => {
  if (!confirm("এই পণ্য মুছে ফেলতে চান?")) return;
  await db.collection("products").doc(id).delete();
  loadProducts();
};

window.editProduct = (id) => {
  const p = products.find(x => x.id === id);
  if (p) openProductModal(p);
};

document.getElementById("addProductBtn").onclick = () => openProductModal(null);
document.getElementById("closeProductModalBtn").onclick = () => closeProductModal();

function openProductModal(product) {
  editingProductId = product ? product.id : null;
  document.getElementById("productModalTitle").innerText = product ? "পণ্য এডিট করুন" : "নতুন পণ্য";
  document.getElementById("pTitle").value = product ? (product.title || "") : "";
  document.getElementById("pRegPrice").value = product ? (product.regularPrice || "") : "";
  document.getElementById("pDiscPrice").value = product ? (product.discountPrice || "") : "";
  document.getElementById("pCod").checked = product ? (product.codAvailable !== false) : true;
  document.getElementById("pDescription").value = product ? (product.description || "") : "";
  document.getElementById("pDiscPreview").innerText = "";

  productImages = product && product.images ? [...product.images] : [];
  colorData = product && product.colors ? JSON.parse(JSON.stringify(product.colors)) : [];
  sizeData = product && product.sizes ? JSON.parse(JSON.stringify(product.sizes)) : [];

  const selectedCats = product && product.categories && product.categories.length > 0
    ? product.categories
    : (product && product.category ? [product.category] : []);

  renderCategoryCheckboxes(selectedCats);
  renderProductImagesPreview();
  renderColorRows();
  renderSizeRows();
  updateDiscPreview();

  document.getElementById("productModal").classList.add("show");
}

function closeProductModal() {
  document.getElementById("productModal").classList.remove("show");
}

function updateDiscPreview() {
  const reg = parseFloat(document.getElementById("pRegPrice").value) || 0;
  const disc = parseFloat(document.getElementById("pDiscPrice").value) || 0;
  const preview = document.getElementById("pDiscPreview");
  if (reg > 0 && disc > 0 && disc < reg) {
    const pct = Math.round(((reg - disc) / reg) * 100);
    preview.innerText = `${pct}% ছাড়`;
  } else {
    preview.innerText = "";
  }
}
document.getElementById("pRegPrice").addEventListener("input", updateDiscPreview);
document.getElementById("pDiscPrice").addEventListener("input", updateDiscPreview);

// ---------- PRODUCT MAIN IMAGES ----------
document.getElementById("pImagesInput").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  for (const file of files) {
    const url = await uploadToCloudinary(file);
    productImages.push(url);
  }
  renderProductImagesPreview();
  e.target.value = "";
});

function renderProductImagesPreview() {
  const box = document.getElementById("pImagesPreview");
  box.innerHTML = productImages.map((url, i) => `
    <div style="position:relative;">
      <img src="${url}">
      <button onclick="removeProductImage(${i})" style="position:absolute; top:-6px; right:-6px; background:#dc3545; color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:11px;">✕</button>
    </div>
  `).join("");
}

window.removeProductImage = (i) => {
  productImages.splice(i, 1);
  renderProductImagesPreview();
};

// ---------- COLOR ROWS ----------
function renderColorRows() {
  const box = document.getElementById("colorRowsContainer");
  box.innerHTML = colorData.map((c, i) => `
    <div class="color-row-box">
      <input type="text" placeholder="রং এর নাম" value="${c.name || ''}" data-ci="${i}" class="colorName">
      <input type="color" value="${c.hex || '#000000'}" data-ci="${i}" class="colorHex" style="width:100%; height:40px;">
      <input type="number" placeholder="দাম (অপশনাল)" value="${c.price || ''}" data-ci="${i}" class="colorPrice">
      <input type="number" placeholder="ডিসকাউন্ট দাম" value="${c.discountPrice || ''}" data-ci="${i}" class="colorDisc">
      <input type="file" accept="image/*" multiple class="colorImgInput" data-ci="${i}">
      <div class="img-thumb-row">
        ${(c.images || []).map((img, ii) => `
          <div style="position:relative;">
            <img src="${img}">
            <button class="del-btn" data-ci="${i}" data-ii="${ii}" style="position:absolute; top:-6px; right:-6px; background:#dc3545; color:#fff; border:none; border-radius:50%; width:18px; height:18px; font-size:10px;">✕</button>
          </div>
        `).join("")}
      </div>
      <button class="btn-sm btn-red del-btn" data-ci="${i}">এই রংটি মুছুন</button>
    </div>
  `).join("");

  box.querySelectorAll(".colorName").forEach(inp => {
    inp.oninput = () => { colorData[inp.dataset.ci].name = inp.value; };
  });
  box.querySelectorAll(".colorHex").forEach(inp => {
    inp.oninput = () => { colorData[inp.dataset.ci].hex = inp.value; };
  });
  box.querySelectorAll(".colorPrice").forEach(inp => {
    inp.oninput = () => { colorData[inp.dataset.ci].price = inp.value; };
  });
  box.querySelectorAll(".colorDisc").forEach(inp => {
    inp.oninput = () => { colorData[inp.dataset.ci].discountPrice = inp.value; };
  });
  box.querySelectorAll(".colorImgInput").forEach(inp => {
    inp.onchange = async (e) => {
      const ci = e.target.dataset.ci;
      const files = Array.from(e.target.files);
      for (const file of files) {
        const url = await uploadToCloudinary(file);
        if (!colorData[ci].images) colorData[ci].images = [];
        colorData[ci].images.push(url);
      }
      renderColorRows();
    };
  });
  box.querySelectorAll(".del-btn[data-ci][data-ii]").forEach(btn => {
    btn.onclick = () => {
      const ci = btn.dataset.ci, ii = btn.dataset.ii;
      colorData[ci].images.splice(ii, 1);
      renderColorRows();
    };
  });
  box.querySelectorAll(".del-btn[data-ci]:not([data-ii])").forEach(btn => {
    btn.onclick = () => {
      colorData.splice(btn.dataset.ci, 1);
      renderColorRows();
    };
  });
}

document.getElementById("addColorBtn").onclick = () => {
  colorData.push({ name: "", hex: "#000000", images: [], price: "", discountPrice: "" });
  renderColorRows();
};

// ---------- SIZE ROWS ----------
function renderSizeRows() {
  const box = document.getElementById("sizeRowsContainer");
  box.innerHTML = sizeData.map((s, i) => `
    <div class="size-row-box">
      <input type="text" placeholder="সাইজের নাম (যেমন M, L, XL)" value="${s.name || ''}" data-si="${i}" class="sizeName">
      <input type="number" placeholder="দাম (অপশনাল)" value="${s.price || ''}" data-si="${i}" class="sizePrice">
      <input type="number" placeholder="ডিসকাউন্ট দাম" value="${s.discountPrice || ''}" data-si="${i}" class="sizeDisc">
      <button class="btn-sm btn-red del-btn" data-si="${i}">এই সাইজ মুছুন</button>
    </div>
  `).join("");

  box.querySelectorAll(".sizeName").forEach(inp => {
    inp.oninput = () => { sizeData[inp.dataset.si].name = inp.value; };
  });
  box.querySelectorAll(".sizePrice").forEach(inp => {
    inp.oninput = () => { sizeData[inp.dataset.si].price = inp.value; };
  });
  box.querySelectorAll(".sizeDisc").forEach(inp => {
    inp.oninput = () => { sizeData[inp.dataset.si].discountPrice = inp.value; };
  });
  box.querySelectorAll(".del-btn[data-si]").forEach(btn => {
    btn.onclick = () => {
      sizeData.splice(btn.dataset.si, 1);
      renderSizeRows();
    };
  });
}

document.getElementById("addSizeBtn").onclick = () => {
  sizeData.push({ name: "", price: "", discountPrice: "" });
  renderSizeRows();
};

// ---------- SAVE PRODUCT ----------
document.getElementById("saveProductBtn").onclick = async () => {
  if (savingInProgress) return;

  const title = document.getElementById("pTitle").value.trim();
  const regPrice = parseFloat(document.getElementById("pRegPrice").value) || 0;
  const discPrice = parseFloat(document.getElementById("pDiscPrice").value) || null;
  const codAvailable = document.getElementById("pCod").checked;
  const description = document.getElementById("pDescription").value.trim();

  const selectedCategories = Array.from(document.querySelectorAll(".pCatCheck:checked")).map(cb => cb.value);

  if (!title) return alert("পণ্যের নাম লিখুন");
  if (!regPrice) return alert("নিয়মিত দাম লিখুন");
  if (selectedCategories.length === 0) return alert("অন্তত একটি ক্যাটাগরি বাছাই করুন");
  if (productImages.length === 0) return alert("অন্তত একটি ছবি আপলোড করুন");

  const cleanedColors = colorData
    .filter(c => c.name && c.name.trim())
    .map(c => ({
      name: c.name.trim(),
      hex: c.hex || "#000000",
      images: c.images || [],
      price: c.price || null,
      discountPrice: c.discountPrice || null
    }));

  const cleanedSizes = sizeData
    .filter(s => s.name && s.name.trim())
    .map(s => ({
      name: s.name.trim(),
      price: s.price || null,
      discountPrice: s.discountPrice || null
    }));

  const btn = document.getElementById("saveProductBtn");
  savingInProgress = true;
  btn.disabled = true;
  btn.innerText = "সেভ হচ্ছে...";

  try {
    const data = {
      title,
      regularPrice: regPrice,
      discountPrice: discPrice,
      codAvailable,
      description,
      categories: selectedCategories,
      images: productImages,
      colors: cleanedColors,
      sizes: cleanedSizes,
      updatedAt: new Date()
    };

    if (editingProductId) {
      await db.collection("products").doc(editingProductId).update(data);
    } else {
      data.createdAt = new Date();
      await db.collection("products").add(data);
    }

    closeProductModal();
    loadProducts();
  } catch (e) {
    alert("সেভ করতে সমস্যা হয়েছে: " + e.message);
  } finally {
    savingInProgress = false;
    btn.disabled = false;
    btn.innerText = "সেভ করুন";
  }
};

// ================= ORDERS =================
async function loadOrders() {
  const box = document.getElementById("ordersList");
  box.innerHTML = "লোড হচ্ছে...";
  try {
    const snap = await db.collection("orders").orderBy("createdAt", "desc").get();
    const orders = [];
    snap.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
    renderOrdersList(orders);
  } catch (e) {
    box.innerHTML = "<p>অর্ডার লোড করা যায়নি: " + e.message + "</p>";
  }
}

function renderOrdersList(orders) {
  const box = document.getElementById("ordersList");
  if (orders.length === 0) {
    box.innerHTML = "<p>কোনো অর্ডার নেই।</p>";
    return;
  }
  box.innerHTML = orders.map(o => {
    const statusColor = o.status === "delivery" ? "btn-green" : o.status === "processing" ? "btn-blue" : "btn-yellow";
    const waText = `আসসালামু আলাইকুম ${o.customerName}, আপনার অর্ডার (${o.orderId}) সম্পর্কে যোগাযোগ করছি।`;
    return `
    <div class="list-row" style="flex-direction:column; align-items:stretch;">
      <div><strong>${o.productTitle || ''}</strong> | রং: ${o.color || '-'} | সাইজ: ${o.size || '-'}</div>
      <div>দাম: ৳${o.price || 0} ${o.discountPrice ? '(ছাড়ে ৳' + o.discountPrice + ')' : ''} | ডেলিভারি: ৳${o.deliveryCharge || 0}</div>
      <div>পেমেন্ট: ${o.paymentMethod || ''} | অর্ডার আইডি: ${o.orderId || ''}</div>
      <div>কাস্টমার: ${o.customerName || ''} | ফোন: ${o.customerPhone || ''}</div>
      <div>ঠিকানা: ${o.address || ''}</div>
      <div style="font-size:12px; color:#888;">${formatDate(o.createdAt)}</div>
      <div style="margin-top:8px;">
        <button class="btn-sm ${o.status==='pending' || !o.status ? 'btn-yellow' : 'btn-gray'}" onclick="updateOrderStatus('${o.id}','pending')">Pending</button>
        <button class="btn-sm ${o.status==='processing' ? 'btn-blue' : 'btn-gray'}" onclick="updateOrderStatus('${o.id}','processing')">Processing</button>
        <button class="btn-sm ${o.status==='delivery' ? 'btn-green' : 'btn-gray'}" onclick="updateOrderStatus('${o.id}','delivery')">Delivery</button>
        <a class="btn-sm btn-dark" style="text-decoration:none;" href="${whatsappLink(o.customerPhone, waText)}" target="_blank">WhatsApp</a>
        <button class="btn-sm btn-red" onclick="deleteOrder('${o.id}')">মুছুন</button>
      </div>
    </div>
    `;
  }).join("");
}

window.updateOrderStatus = async (docId, newStatus) => {
  await db.collection("orders").doc(docId).update({ status: newStatus });
  loadOrders();
};

window.deleteOrder = async (docId) => {
  if (!confirm("এই অর্ডার মুছে ফেলতে চান?")) return;
  await db.collection("orders").doc(docId).delete();
  loadOrders();
};

// ================= BANNERS =================
async function loadBanners() {
  const box = document.getElementById("bannersList");
  box.innerHTML = "লোড হচ্ছে...";
  const snap = await db.collection("settings").doc("homepage").get();
  const images = snap.exists ? (snap.data().bannerImages || []) : [];
  if (images.length === 0) {
    box.innerHTML = "<p>কোনো ব্যানার নেই।</p>";
    return;
  }
  box.innerHTML = images.map((url, i) => `
    <div style="position:relative;">
      <img src="${url}" style="width:100px; height:100px; object-fit:cover; border-radius:8px;">
      <button onclick="deleteBanner(${i})" style="position:absolute; top:-6px; right:-6px; background:#dc3545; color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:11px;">✕</button>
    </div>
  `).join("");
}

document.getElementById("uploadBannerBtn").onclick = async () => {
  const input = document.getElementById("bannerUploadInput");
  const files = Array.from(input.files);
  if (files.length === 0) return alert("ছবি বাছাই করুন");

  const btn = document.getElementById("uploadBannerBtn");
  btn.disabled = true;
  btn.innerText = "আপলোড হচ্ছে...";

  try {
    const urls = [];
    for (const file of files) {
      const url = await uploadToCloudinary(file);
      urls.push(url);
    }
    const ref = db.collection("settings").doc("homepage");
    const snap = await ref.get();
    const existing = snap.exists ? (snap.data().bannerImages || []) : [];
    await ref.set({ bannerImages: [...existing, ...urls] }, { merge: true });
    input.value = "";
    loadBanners();
  } catch (e) {
    alert("আপলোড সমস্যা: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "আপলোড করুন";
  }
};

window.deleteBanner = async (index) => {
  if (!confirm("এই ব্যানার মুছে ফেলতে চান?")) return;
  const ref = db.collection("settings").doc("homepage");
  const snap = await ref.get();
  const existing = snap.exists ? (snap.data().bannerImages || []) : [];
  existing.splice(index, 1);
  await ref.set({ bannerImages: existing }, { merge: true });
  loadBanners();
};

// ================= SETTINGS (bKash) =================
async function loadBkashSettings() {
  const snap = await db.collection("settings").doc("bkash").get();
  if (snap.exists) {
    const d = snap.data();
    document.getElementById("bkashNumberInput").value = d.number || "";
    bkashQrUrl = d.qrUrl || "";
    if (bkashQrUrl) {
      document.getElementById("bkashQrPreview").innerHTML = `<img src="${bkashQrUrl}" style="width:100px; margin-top:8px; border-radius:8px;">`;
    }
  }
}

document.getElementB
