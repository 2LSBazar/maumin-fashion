import { db, auth } from "./firebase-config.js";
import { SITE_CONFIG } from "./site-config.js";
import {
  collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ---------- Auth চেক ----------
onAuthStateChanged(auth, user => {
  if(!user) window.location.href = "admin-login.html";
});

document.getElementById("logoutBtn").onclick = async () => {
  await signOut(auth);
  window.location.href = "admin-login.html";
};

// ---------- ট্যাব সুইচ ----------
document.querySelectorAll(".atab").forEach(t => {
  t.onclick = () => {
    document.querySelectorAll(".atab").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    document.querySelectorAll(".tab-body").forEach(b => b.style.display = "none");
    document.getElementById("tab-" + t.dataset.tab).style.display = "block";
  };
});

// ---------- Cloudinary আপলোড ----------
async function uploadImage(file){
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", SITE_CONFIG.cloudinaryUploadPreset);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${SITE_CONFIG.cloudinaryCloudName}/image/upload`,
    { method: "POST", body: fd }
  );
  const data = await res.json();
  if(!data.secure_url) throw new Error("আপলোড ব্যর্থ");
  return data.secure_url;
}

// ---------- ক্যাটাগরি ----------
let categories = [];

async function loadCategories(){
  const snap = await getDocs(collection(db, "categories"));
  categories = [];
  snap.forEach(d => categories.push({ id: d.id, name: d.data().name }));
  renderCatList();
  fillCatDropdown();
}

function renderCatList(){
  const list = document.getElementById("catList");
  list.innerHTML = "";
  if(!categories.length){
    list.innerHTML = `<p class="empty-msg">কোনো ক্যাটাগরি নেই। উপরে নাম লিখে যোগ করুন।</p>`;
    return;
  }
  categories.forEach(c => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `<span>${c.name}</span>`;
    const del = document.createElement("button");
    del.textContent = "🗑 মুছুন";
    del.className = "del-btn";
    del.onclick = async () => {
      if(!confirm(`"${c.name}" ক্যাটাগরি মুছবেন? (প্রোডাক্টগুলো থেকে যাবে)`)) return;
      await deleteDoc(doc(db, "categories", c.id));
      loadCategories();
    };
    row.appendChild(del);
    list.appendChild(row);
  });
}

function fillCatDropdown(){
  const sel = document.getElementById("fCategory");
  sel.innerHTML = `<option value="">-- ক্যাটাগরি সিলেক্ট করুন --</option>`;
  categories.forEach(c => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.name;
    sel.appendChild(o);
  });
}

document.getElementById("addCatBtn").onclick = async () => {
  const name = document.getElementById("newCatName").value.trim();
  if(!name){ alert("ক্যাটাগরির নাম লিখুন"); return; }
  const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now().toString(36);
  await setDoc(doc(db, "categories", id), { name, createdAt: serverTimestamp() });
  document.getElementById("newCatName").value = "";
  loadCategories();
};

// ---------- ব্যানার ----------
async function loadBanners(){
  const s = await getDoc(doc(db, "settings", "homepage"));
  const banners = (s.exists() && s.data().bannerImages) ? s.data().bannerImages : [];
  renderBannerList(banners);
}

function renderBannerList(banners){
  const list = document.getElementById("bannerList");
  list.innerHTML = "";
  banners.forEach((url, i) => {
    const wrap = document.createElement("div");
    wrap.style.position = "relative";
    wrap.innerHTML = `<img src="${url}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;">`;
    const del = document.createElement("button");
    del.textContent = "✕";
    del.style.cssText = "position:absolute;top:-6px;right:-6px;background:#c0392b;color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;";
    del.onclick = async () => {
      if(!confirm("এই ব্যানার মুছবেন?")) return;
      banners.splice(i, 1);
      await setDoc(doc(db, "settings", "homepage"), { bannerImages: banners });
      loadBanners();
    };
    wrap.appendChild(del);
    list.appendChild(wrap);
  });
}

document.getElementById("bannerInput").onchange = async (e) => {
  const files = [...e.target.files];
  if(!files.length) return;
  const status = document.getElementById("bannerUploadStatus");
  const s = await getDoc(doc(db, "settings", "homepage"));
  const banners = (s.exists() && s.data().bannerImages) ? s.data().bannerImages : [];

  for(let i = 0; i < files.length; i++){
    status.textContent = `আপলোড হচ্ছে ${i+1}/${files.length}...`;
    try{
      const url = await uploadImage(files[i]);
      banners.push(url);
    }catch(err){
      status.textContent = "কিছু ছবি আপলোড হয়নি, আবার চেষ্টা করুন";
    }
  }
  await setDoc(doc(db, "settings", "homepage"), { bannerImages: banners });
  status.textContent = "✅ আপলোড শেষ!";
  document.getElementById("bannerInput").value = "";
  loadBanners();
};

// ---------- প্রোডাক্ট লিস্ট ----------
let allProducts = [];

async function loadProducts(){
  const snap = await getDocs(collection(db, "products"));
  allProducts = [];
  snap.forEach(d => allProducts.push({ id: d.id, ...d.data() }));
  renderAdminProducts();
}

function renderAdminProducts(){
  const q = document.getElementById("adminProductSearch").value.toLowerCase();
  const list = document.getElementById("adminProductList");
  const filtered = allProducts.filter(p => p.title.toLowerCase().includes(q));

  list.innerHTML = "";
  if(!filtered.length){
    list.innerHTML = `<p class="empty-msg">কোনো প্রোডাক্ট নেই</p>`;
    return;
  }

  filtered.forEach(p => {
    const row = document.createElement("div");
    row.className = "list-row";
    const img = (p.images && p.images[0]) || "assets/logo.png";
    const catName = categories.find(c => c.id === p.categoryId)?.name || "";
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="${img}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;">
        <div>
          <b>${p.title}</b><br>
          <small style="color:var(--gray);">${catName} | ৳${p.discountPrice || p.regularPrice}</small>
        </div>
      </div>`;
    const edit = document.createElement("button");
    edit.textContent = "✏️ এডিট";
    edit.className = "edit-btn";
    edit.onclick = () => openProductForm(p);
    const del = document.createElement("button");
    del.textContent = "🗑";
    del.className = "del-btn";
    del.onclick = async () => {
      if(!confirm(`"${p.title}" মুছে ফেলবেন?`)) return;
      await deleteDoc(doc(db, "products", p.id));
      loadProducts();
    };
    row.appendChild(edit);
    row.appendChild(del);
    list.appendChild(row);
  });
}

document.getElementById("adminProductSearch").addEventListener("input", renderAdminProducts);

// ---------- প্রোডাক্ট ফর্ম ----------
const pModal = document.getElementById("pFormModal");
let mainImages = [];
let editingId = null;
let colorData = [];
let sizeData = [];
let savingInProgress = false;   // ⬅️ ডুপ্লিকেট সেভ বন্ধ করার জন্য

document.getElementById("addProductBtn").onclick = () => openProductForm(null);
document.getElementById("closePForm").onclick = () => pModal.classList.remove("show");

function openProductForm(p){
  editingId = p ? p.id : null;
  document.getElementById("pFormTitle").textContent = p ? "প্রোডাক্ট এডিট করুন" : "নতুন প্রোডাক্ট";
  document.getElementById("fTitle").value = p?.title || "";
  document.getElementById("fCategory").value = p?.categoryId || "";
  document.getElementById("fRegPrice").value = p?.regularPrice || "";
  document.getElementById("fDiscPrice").value = p?.discountPrice || "";
  document.getElementById("fDesc").value = p?.description || "";
  document.getElementById("fCod").checked = p ? !!p.codAvailable : true;
  document.getElementById("discPreview").textContent = "";
  document.getElementById("uploadStatus").textContent = "";

  mainImages = p ? [...(p.images || [])] : [];
  colorData = p ? JSON.parse(JSON.stringify(p.colors || [])) : [];
  sizeData = p ? JSON.parse(JSON.stringify(p.sizes || [])) : [];

  renderMainThumbs();
  renderColorRows();
  renderSizeRows();
  pModal.classList.add("show");
}

document.getElementById("fDiscPrice").addEventListener("input", () => {
  const reg = parseFloat(document.getElementById("fRegPrice").value);
  const disc = parseFloat(document.getElementById("fDiscPrice").value);
  const el = document.getElementById("discPreview");
  if(reg && disc && disc < reg){
    el.textContent = `ডিসকাউন্ট: ${Math.round(((reg - disc) / reg) * 100)}% ছাড়`;
  } else el.textContent = "";
});

document.getElementById("fImages").onchange = async (e) => {
  const files = [...e.target.files];
  const status = document.getElementById("uploadStatus");
  for(let i = 0; i < files.length; i++){
    status.textContent = `ছবি আপলোড হচ্ছে ${i+1}/${files.length}...`;
    try{
      mainImages.push(await uploadImage(files[i]));
      renderMainThumbs();
    }catch(err){
      alert("একটি ছবি আপলোড হয়নি");
    }
  }
  status.textContent = "";
  e.target.value = "";
};

function renderMainThumbs(){
  const box = document.getElementById("mainImgThumbs");
  box.innerHTML = "";
  mainImages.forEach((url, i) => {
    const w = document.createElement("div");
    w.style.position = "relative";
    w.innerHTML = `<img src="${url}" class="thumb">`;
    const del = document.createElement("button");
    del.textContent = "✕";
    del.style.cssText = "position:absolute;top:-6px;right:-6px;background:#c0392b;color:white;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:11px;";
    del.onclick = () => { mainImages.splice(i, 1); renderMainThumbs(); };
    w.appendChild(del);
    box.appendChild(w);
  });
}

// ---------- কালার (এখন দামসহ) ----------
document.getElementById("addColorBtn").onclick = () => {
  colorData.push({ name: "", hex: "#000000", images: [], price: "", discountPrice: "" });
  renderColorRows();
};

function renderColorRows(){
  const box = document.getElementById("colorRows");
  box.innerHTML = "";
  colorData.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "dyn-row";
    row.innerHTML = `
      <input type="color" value="${c.hex}" data-ci="${i}" class="colorPicker" style="width:44px;height:44px;border:none;cursor:pointer;background:none;">
      <input type="text" placeholder="কালারের নাম" value="${c.name}" data-ci="${i}" class="colorName" style="flex:1;min-width:100px;padding:10px;border:1px solid #ddd;border-radius:8px;">
      <input type="number" placeholder="দাম (অপশনাল)" value="${c.price || ''}" data-ci="${i}" class="colorPrice" style="width:95px;padding:10px;border:1px solid #ddd;border-radius:8px;">
      <input type="number" placeholder="ডিসকাউন্ট" value="${c.discountPrice || ''}" data-ci="${i}" class="colorDisc" style="width:95px;padding:10px;border:1px solid #ddd;border-radius:8px;">
      <label class="small-btn" style="cursor:pointer;">📸 ছবি
        <input type="file" accept="image/*" multiple data-ci="${i}" class="colorImgs" style="display:none;">
      </label>
      <button type="button" class="del-btn" data-ci="${i}">✕</button>
      <div class="thumb-row" data-ci="${i}" style="width:100%;"></div>`;
    box.appendChild(row);
  });

  box.querySelectorAll(".colorPicker").forEach(inp => inp.onchange = e => {
    colorData[e.target.dataset.ci].hex = e.target.value;
  });
  box.querySelectorAll(".colorName").forEach(inp => inp.oninput = e => {
    colorData[e.target.dataset.ci].name = e.target.value;
  });
  box.querySelectorAll(".colorPrice").forEach(inp => inp.oninput = e => {
    colorData[e.target.dataset.ci].price = parseFloat(e.target.value) || "";
  });
  box.querySelectorAll(".colorDisc").forEach(inp => inp.oninput = e => {
    colorData[e.target.dataset.ci].discountPrice = parseFloat(e.target.value) || "";
  });
  box.querySelectorAll(".colorImgs").forEach(inp => inp.onchange = async e => {
    const i = e.target.dataset.ci;
    const files = [...e.target.files];
    const status = document.getElementById("uploadStatus");
    for(let f = 0; f < files.length; f++){
      status.textContent = `কালারের ছবি আপলোড হচ্ছে ${f+1}/${files.length}...`;
      try{
        colorData[i].images.push(await uploadImage(files[f]));
        renderColorRows();
      }catch(err){ alert("ছবি আপলোড হয়নি"); }
    }
    status.textContent = "";
  });
  box.querySelectorAll(".del-btn[data-ci]").forEach(btn => btn.onclick = e => {
    colorData.splice(e.target.dataset.ci, 1);
    renderColorRows();
  });
  box.querySelectorAll(".thumb-row").forEach(tr => {
    const i = tr.dataset.ci;
    colorData[i].images.forEach((url, j) => {
      const w = document.createElement("div");
      w.style.position = "relative";
      w.innerHTML = `<img src="${url}" class="thumb">`;
      const del = document.createElement("button");
      del.textContent = "✕";
      del.style.cssText = "position:absolute;top:-6px;right:-6px;background:#c0392b;color:white;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:11px;";
      del.onclick = () => { colorData[i].images.splice(j, 1); renderColorRows(); };
      w.appendChild(del);
      tr.appendChild(w);
    });
  });
}

// সাইজ
document.getElementById("addSizeBtn").onclick = () => {
  sizeData.push({ name: "", price: "", discountPrice: "" });
  renderSizeRows();
};

function renderSizeRows(){
  const box = document.getElementById("sizeRows");
  box.innerHTML = "";
  sizeData.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "dyn-row";
    row.innerHTML = `
      <input type="text" placeholder="সাইজ (যেমন: 40)" value="${s.name}" data-si="${i}" class="sizeName" style="width:80px;padding:10px;border:1px solid #ddd;border-radius:8px;">
      <input type="number" placeholder="দাম" value="${s.price}" data-si="${i}" class="sizePrice" style="width:90px;padding:10px;border:1px solid #ddd;border-radius:8px;">
      <input type="number" placeholder="ডিসকাউন্ট" value="${s.discountPrice}" data-si="${i}" class="sizeDisc" style="width:100px;padding:10px;border:1px solid #ddd;border-radius:8px;">
      <button type="button" class="del-btn" data-si="${i}">✕</button>`;
    box.appendChild(row);
  });
  box.querySelectorAll(".sizeName").forEach(inp => inp.oninput = e => sizeData[e.target.dataset.si].name = e.target.value);
  box.querySelectorAll(".sizePrice").forEach(inp => inp.oninput = e => sizeData[e.target.dataset.si].price = parseFloat(e.target.value) || "");
  box.querySelectorAll(".sizeDisc").forEach(inp => inp.oninput = e => sizeData[e.target.dataset.si].discountPrice = parseFloat(e.target.value) || "");
  box.querySelectorAll(".del-btn[data-si]").forEach(btn => btn.onclick = e => {
    sizeData.splice(e.target.dataset.si, 1);
    renderSizeRows();
  });
}

// ---------- সেভ (ডুপ্লিকেট ফিক্সসহ) ----------
document.getElementById("saveProductBtn").onclick = async () => {
  if(savingInProgress) return;   // ⬅️ আগে থেকে সেভ হচ্ছে থাকলে আটকে দেয়

  const title = document.getElementById("fTitle").value.trim();
  const categoryId = document.getElementById("fCategory").value;
  const regPrice = parseFloat(document.getElementById("fRegPrice").value);
  const discPrice = parseFloat(document.getElementById("fDiscPrice").value);
  const description = document.getElementById("fDesc").value.trim();
  const codAvailable = document.getElementById("fCod").checked;

  if(!title){ alert("প্রোডাক্টের নাম দিন"); return; }
  if(!categoryId){ alert("ক্যাটাগরি সিলেক্ট করুন"); return; }
  if(!regPrice){ alert("রেগুলার দাম দিন"); return; }
  if(!mainImages.length){ alert("অন্তত একটি ছবি আপলোড করুন"); return; }

  savingInProgress = true;
  const btn = document.getElementById("saveProductBtn");
  btn.disabled = true;
  btn.textContent = "সেভ হচ্ছে...";

  const cleanedColors = colorData
    .filter(c => c.name)
    .map(c => ({
      name: c.name, hex: c.hex, images: c.images,
      price: c.price || null, discountPrice: c.discountPrice || null
    }));
  const cleanedSizes = sizeData
    .filter(s => s.name && s.price)
    .map(s => ({ name: s.name, price: s.price, discountPrice: s.discountPrice || null }));

  const catName = categories.find(c => c.id === categoryId)?.name || "";

  const data = {
    title, categoryId, categoryName: catName,
    regularPrice: regPrice,
    discountPrice: (discPrice && discPrice < regPrice) ? discPrice : null,
    images: mainImages,
    colors: cleanedColors,
    sizes: cleanedSizes,
    description, codAvailable
  };

  try{
    if(editingId){
      await updateDoc(doc(db, "products", editingId), data);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "products"), data);
    }
    pModal.classList.remove("show");
    loadProducts();
  }catch(err){
    alert("সেভ হয়নি, আবার চেষ্টা করুন");
    console.error(err);
  }finally{
    savingInProgress = false;
    btn.disabled = false;
    btn.textContent = "💾 সেভ করুন";
  }
};

// ---------- অর্ডার ----------
async function loadOrders(){
  const list = document.getElementById("ordersList");
  const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
  list.innerHTML = "";

  if(snap.empty){
    list.innerHTML = `<p class="empty-msg">এখনো কোনো অর্ডার আসেনি</p>`;
    return;
  }

  snap.forEach(d => {
    const o = d.data();
    const date = o.createdAt?.toDate?.().toLocaleString("bn-BD") || "";
    const payMethod = o.paymentMethod === "cod" ? "💰 ক্যাশ অন ডেলিভারি" : "📱 বিকাশ";
    const isPending = o.status === "pending";

    const card = document.createElement("div");
    card.className = "order-card" + (isPending ? " pending" : "");
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <b>${o.productTitle}</b>
        <span class="status-badge ${o.status}">${o.status === "pending" ? "⏳ নতুন" : o.status === "done" ? "✅ সম্পন্ন" : o.status}</span>
      </div>
      ${o.color ? `<div>কালার: ${o.color}</div>` : ""}
      ${o.size ? `<div>সাইজ: ${o.size}</div>` : ""}
      <div>দাম: <b>৳${o.price}</b> | ${payMethod}</div>
      <hr style="border:none;border-top:1px dashed #ddd;margin:8px 0;">
      <div>👤 ${o.customerName} | 📞 <a href="tel:${o.customerPhone}">${o.customerPhone}</a></div>
      <div style="color:var(--gray);font-size:13px;">📍 ${o.address}</div>
      <div style="color:var(--gray);font-size:12px;margin-top:4px;">🕒 ${date}</div>
      <a href="https://wa.me/${o.customerPhone.replace(/^0/, "880")}" target="_blank"
         style="display:inline-block;margin-top:8px;font-size:13px;color:#25D366;font-weight:bold;">💬 WhatsApp এ মেসেজ দিন</a>`;

    const doneBtn = document.createElement("button");
    doneBtn.textContent = isPending ? "✅ সম্পন্ন করুন" : "↩️ পেন্ডিং করুন";
    doneBtn.className = "edit-btn";
    doneBtn.onclick = async () => {
      await updateDoc(doc(db, "orders", d.id), { status: isPending ? "done" : "pending" });
      loadOrders();
    };
    const delBtn = document.createElement("button");
    delBtn.textContent = "🗑";
    delBtn.className = "del-btn";
    delBtn.onclick = async () => {
      if(!confirm("এই অর্ডার মুছবেন?")) return;
      await deleteDoc(doc(db, "orders", d.id));
      loadOrders();
    };
    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;margin-top:8px;";
    btnRow.appendChild(doneBtn);
    btnRow.appendChild(delBtn);
    card.appendChild(btnRow);

    list.appendChild(card);
  });
}

// ---------- বিকাশ সেটিংস ----------
async function loadBkashSettings(){
  const s = await getDoc(doc(db, "settings", "bkash"));
  if(s.exists()){
    const d = s.data();
    document.getElementById("bkashNumber").value = d.number || "";
    if(d.qrImage){
      const prev = document.getElementById("bkashQRPreview");
      prev.src = d.qrImage;
      prev.style.display = "block";
    }
  }
}

let newQrUrl = null;
document.getElementById("bkashQRInput").onchange = async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const status = document.getElementById("settingsStatus");
  status.textContent = "QR আপলোড হচ্ছে...";
  try{
    newQrUrl = await uploadImage(file);
    const prev = document.getElementById("bkashQRPreview");
    prev.src = newQrUrl;
    prev.style.display = "block";
    status.textContent = "";
  }catch(err){
    status.textContent = "আপলোড ব্যর্থ, আবার চেষ্টা করুন";
  }
};

document.getElementById("saveSettingsBtn").onclick = async () => {
  const number = document.getElementById("bkashNumber").value.trim();
  const s = await getDoc(doc(db, "settings", "bkash"));
  const qrImage = newQrUrl || (s.exists() ? s.data().qrImage : null);
  await setDoc(doc(db, "settings", "bkash"), { number, qrImage: qrImage || null });
  const st = document.getElementById("settingsStatus");
  st.textContent = "✅ সেভ হয়ে গেছে!";
  setTimeout(() => st.textContent = "", 3000);
};

// ---------- শুরু ----------
loadCategories();
loadProducts();
loadBanners();
loadOrders();
loadBkashSettings();

window.updateOrderStatus = async (docId, newStatus) => {
  await db.collection("orders").doc(docId).update({ status: newStatus });
  renderOrders(); // আবার লিস্ট লোড হবে
  alert("স্ট্যাটাস আপডেট: " + newStatus);
};

<div style="margin-top:6px;">
  <button onclick="updateOrderStatus('${doc.id}','pending')" style="font-size:12px;padding:2px 6px;">Pending</button>
  <button onclick="updateOrderStatus('${doc.id}','processing')" style="font-size:12px;padding:2px 6px;">Processing</button>
  <button onclick="updateOrderStatus('${doc.id}','delivery')" style="font-size:12px;padding:2px 6px;">Delivery</button>
</div>

