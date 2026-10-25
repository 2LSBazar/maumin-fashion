import { db } from "./firebase-config.js";
import { SITE_CONFIG } from "./site-config.js";
import { doc, getDoc, addDoc, collection, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

let product = null;
let selectedColor = null;
let selectedSize = null;
let paymentMethod = null;
let bkashSettings = null;
let sliderTimer = null;
let currentSlide = 0;

document.getElementById("whatsappFloat").href = `https://wa.me/${SITE_CONFIG.whatsappNumber}`;

const emailConfigured = !SITE_CONFIG.emailjsPublicKey.startsWith("YOUR_");
if (emailConfigured && window.emailjs) {
  emailjs.init({ publicKey: SITE_CONFIG.emailjsPublicKey });
}

function renderSlider(images, autoSlide){
  clearInterval(sliderTimer);
  const slider = document.getElementById("pSlider");
  slider.innerHTML = "";
  currentSlide = 0;

  images.forEach((url, i) => {
    const img = document.createElement("img");
    img.src = url;
    if(i===0) img.classList.add("active");
    slider.appendChild(img);
  });

  const dots = document.createElement("div");
  dots.className = "slider-dots";
  images.forEach((_, i) => {
    const d = document.createElement("span");
    if(i===0) d.classList.add("active");
    dots.appendChild(d);
  });
  slider.appendChild(dots);

  if(autoSlide && images.length > 1){
    sliderTimer = setInterval(() => {
      const imgs = slider.querySelectorAll("img");
      const dotsEls = slider.querySelectorAll(".slider-dots span");
      imgs[currentSlide].classList.remove("active");
      dotsEls[currentSlide].classList.remove("active");
      currentSlide = (currentSlide + 1) % imgs.length;
      imgs[currentSlide].classList.add("active");
      dotsEls[currentSlide].classList.add("active");
    }, 2500);
  }
}

function allDefaultImages(){
  const set = [...(product.images || [])];
  (product.colors || []).forEach(c =>
    (c.images || []).forEach(u => { if(!set.includes(u)) set.push(u); })
  );
  return set.length ? set : ["assets/logo.png"];
}

// ---------- দাম (এখন কালার ও সাইজ দুটোই চেক করে) ----------
function currentPrice(){
  if(selectedSize && selectedSize.price){
    return { reg: selectedSize.price, disc: selectedSize.discountPrice };
  }
  if(selectedColor && selectedColor.price){
    return { reg: selectedColor.price, disc: selectedColor.discountPrice };
  }
  return { reg: product.regularPrice, disc: product.discountPrice };
}

function renderPrice(){
  const p = currentPrice();
  const hasDisc = p.disc && p.disc < p.reg;
  const pct = hasDisc ? Math.round(((p.reg - p.disc) / p.reg) * 100) : 0;
  document.getElementById("pPrice").innerHTML = hasDisc
    ? `<span class="reg">৳${p.reg}</span><span class="disc">৳${p.disc}</span><span class="pct">-${pct}%</span>`
    : `<span class="disc">৳${p.reg}</span>`;
}

function renderProduct(){
  document.getElementById("pTitle").textContent = product.title;

  renderSlider(allDefaultImages(), true);
  renderPrice();

  if(product.colors && product.colors.length){
    document.getElementById("colorSection").style.display = "block";
    const row = document.getElementById("colorRow");
    product.colors.forEach(c => {
      const sw = document.createElement("div");
      sw.className = "color-swatch";
      sw.style.background = c.hex || "#ccc";
      sw.title = c.name;
      sw.onclick = () => {
        document.querySelectorAll(".color-swatch").forEach(x => x.classList.remove("selected"));
        sw.classList.add("selected");
        selectedColor = c;
        renderSlider((c.images && c.images.length) ? c.images : allDefaultImages(), false);
        renderPrice();   // ⬅️ কালার সিলেক্ট করলে দাম আপডেট হবে
      };
      row.appendChild(sw);
    });
  }

  if(product.sizes && product.sizes.length){
    document.getElementById("sizeSection").style.display = "block";
    const row = document.getElementById("sizeRow");
    product.sizes.forEach(s => {
      const btn = document.createElement("button");
      btn.className = "size-btn";
      btn.textContent = s.name;
      btn.onclick = () => {
        document.querySelectorAll(".size-btn").forEach(x => x.classList.remove("selected"));
        btn.classList.add("selected");
        selectedSize = s;
        renderPrice();
      };
      row.appendChild(btn);
    });
  }

  const badges = document.getElementById("payBadges");
  badges.innerHTML = product.codAvailable
    ? `<span class="pay-badge">✅ ক্যাশ অন ডেলিভারি</span><span class="pay-badge">📱 বিকাশ</span>`
    : `<span class="pay-badge no">বিকাশ পেমেন্ট অনলি</span>`;

  document.getElementById("pDesc").textContent = product.description || "বিবরণ নেই।";
}

async function loadBkash(){
  try{
    const s = await getDoc(doc(db, "settings", "bkash"));
    if(s.exists()) bkashSettings = s.data();
  }catch(e){}
}

const modal = document.getElementById("orderModal");

document.getElementById("orderBtn").onclick = () => {
  if((product.colors?.length) && !selectedColor){ alert("অনুগ্রহ করে কালার সিলেক্ট করুন"); return; }
  if((product.sizes?.length) && !selectedSize){ alert("অনুগ্রহ করে সাইজ সিলেক্ট করুন"); return; }

  const p = currentPrice();
  const finalPrice = (p.disc && p.disc < p.reg) ? p.disc : p.reg;

  document.getElementById("orderSummary").innerHTML = `
    <b>${product.title}</b><br>
    ${selectedColor ? `কালার: ${selectedColor.name} | ` : ""}
    ${selectedSize ? `সাইজ: ${selectedSize.name} | ` : ""}
    দাম: <b>৳${finalPrice}</b>`;

  const codOpt = document.getElementById("codOpt");
  codOpt.style.display = product.codAvailable ? "block" : "none";
  selectPayment(product.codAvailable ? null : "bkash");

  document.getElementById("formView").style.display = "block";
  document.getElementById("successView").classList.remove("show");
  modal.classList.add("show");
};

document.getElementById("closeModal").onclick = () => modal.classList.remove("show");

function selectPayment(method){
  paymentMethod = method;
  document.getElementById("codOpt").classList.toggle("selected", method === "cod");
  document.getElementById("bkashOpt").classList.toggle("selected", method === "bkash");
  document.getElementById("bkashBox").classList.toggle("show", method === "bkash");

  if(method === "bkash" && bkashSettings){
    if(bkashSettings.qrImage) document.getElementById("bkashQR").src = bkashSettings.qrImage;
    document.getElementById("bkashNumber").textContent = bkashSettings.number ? `বিকাশ নাম্বার: ${bkashSettings.number}` : "";
  }
}
document.getElementById("codOpt").onclick = () => selectPayment("cod");
document.getElementById("bkashOpt").onclick = () => selectPayment("bkash");

document.getElementById("confirmOrderBtn").onclick = async () => {
  const name = document.getElementById("cName").value.trim();
  const phone = document.getElementById("cPhone").value.trim();
  const district = document.getElementById("cDistrict").value.trim();
  const thana = document.getElementById("cThana").value.trim();
  const village = document.getElementById("cVillage").value.trim();

  if(!name){ alert("নাম লিখুন"); return; }
  if(!/^01[3-9]\d{8}$/.test(phone)){ alert("সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন"); return; }
  if(!district || !thana || !village){ alert("সম্পূর্ণ ঠিকানা লিখুন (জেলা, থানা, গ্রাম)"); return; }
  if(!paymentMethod){ alert("পেমেন্ট মাধ্যম সিলেক্ট করুন"); return; }

  const p = currentPrice();
  const finalPrice = (p.disc && p.disc < p.reg) ? p.disc : p.reg;

  const btn = document.getElementById("confirmOrderBtn");
  btn.disabled = true;
  btn.textContent = "পাঠানো হচ্ছে...";

  try{
    await addDoc(collection(db, "orders"), {
      productId: product.id,
      productTitle: product.title,
      image: selectedColor?.images?.[0] || product.images?.[0] || "",
      color: selectedColor?.name || "",
      size: selectedSize?.name || "",
      price: finalPrice,
      customerName: name,
      customerPhone: phone,
      address: `${village}, ${thana}, ${district}`,
      paymentMethod: paymentMethod,
      status: "pending",
      createdAt: serverTimestamp()
    });

    if(emailConfigured && window.emailjs){
      try{
        await emailjs.send(SITE_CONFIG.emailjsServiceId, SITE_CONFIG.emailjsTemplateId, {
          product_name: product.title,
          color: selectedColor?.name || "-",
          size: selectedSize?.name || "-",
          price: "৳" + finalPrice,
          customer_name: name,
          customer_phone: phone,
          customer_address: `${village}, ${thana}, ${district}`,
          payment_method: paymentMethod === "cod" ? "ক্যাশ অন ডেলিভারি" : "বিকাশ"
        });
      }catch(e){ console.log("Email যেতে পারেনি:", e); }
    }

    document.getElementById("formView").style.display = "none";
    document.getElementById("successView").classList.add("show");

  }catch(err){
    alert("সমস্যা হয়েছে, আবার চেষ্টা করুন");
    console.error(err);
  }

  btn.disabled = false;
  btn.textContent = "✅ অর্ডার কনফার্ম করুন";
};

document.getElementById("successCloseBtn").onclick = () => {
  modal.classList.remove("show");
  window.location.href = "index.html";
};

if(!productId){
  window.location.href = "index.html";
} else {
  loadProduct();
  loadBkash();
}

async function loadProduct(){
  const snap = await getDoc(doc(db, "products", productId));
  if(!snap.exists()){
    document.getElementById("pTitle").textContent = "পণ্যটি পাওয়া যায়নি";
    return;
  }
  product = { id: snap.id, ...snap.data() };
  renderProduct();
}
