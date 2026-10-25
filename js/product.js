import { db } from "./firebase-config.js";
import { SITE_CONFIG } from "./site-config.js";

let product = null;
let selectedColor = null;
let selectedSize = null;

let userCart = []; // for Phase 2 cart feature later; not fully used yet

function getQueryParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

function generateOrderId() {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return "MM-" + ts + "-" + rand;
}

async function loadProduct() {
  const id = getQueryParam("id");
  if (!id) return;
  const snap = await db.collection("products").doc(id).get();
  if (!snap.exists) {
    document.getElementById("loadingBox").innerText = "পণ্য পাওয়া যায়নি";
    return;
  }
  product = { id: snap.id, ...snap.data() };
  renderProduct();
  document.getElementById("loadingBox").style.display = "none";
  document.getElementById("productWrap").style.display = "block";
}

function renderProduct() {
  document.getElementById("productTitle").innerText = product.title || "পণ্য";
  renderSlider();
  renderColors();
  renderSizes();
  renderPrice();
  renderDesc();
  renderPaymentChoice();
}

function renderSlider() {
  const track = document.getElementById("sliderTrack");
  const dots = document.getElementById("sliderDots");
  track.innerHTML = "";
  dots.innerHTML = "";
  
  let images = [];
  if (selectedColor && selectedColor.images && selectedColor.images.length > 0) {
    images = selectedColor.images;
  } else if (product.images && product.images.length > 0) {
    images = product.images;
  }
  
  images.forEach((src, i) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = product.title;
    img.className = "slide-img";
    if (i === 0) img.classList.add("active");
    track.appendChild(img);
    
    const d = document.createElement("button");
    d.className = "dot" + (i === 0 ? " active" : "");
    d.onclick = () => showSlide(i);
    dots.appendChild(d);
  });
  
  if (images.length > 1) {
    setInterval(() => {
      const active = track.querySelector(".slide-img.active");
      let idx = Array.from(track.children).indexOf(active);
      idx = (idx + 1) % images.length;
      showSlide(idx);
    }, 3500);
  }
}

function showSlide(i) {
  const imgs = document.querySelectorAll(".slide-img");
  const dots = document.querySelectorAll(".dot");
  imgs.forEach((im, idx) => im.classList.toggle("active", idx === i));
  dots.forEach((d, idx) => d.classList.toggle("active", idx === i));
}

function renderColors() {
  const row = document.getElementById("colorRow");
  row.innerHTML = "";
  if (!product.colors || product.colors.length === 0) return;
  
  product.colors.forEach((c, idx) => {
    const btn = document.createElement("button");
    btn.className = "color-btn" + (selectedColor === c ? " selected" : "");
    btn.style.background = c.hex || "#333";
    btn.title = c.name;
    btn.onclick = () => {
      selectedColor = c;
      renderColors();
      renderSlider();
      renderPrice();
    };
    row.appendChild(btn);
  });
}

function renderSizes() {
  const row = document.getElementById("sizeRow");
  row.innerHTML = "";
  if (!product.sizes || product.sizes.length === 0) return;
  
  product.sizes.forEach(s => {
    const btn = document.createElement("button");
    btn.className = "size-btn" + (selectedSize === s ? " selected" : "");
    btn.innerText = s.name;
    btn.onclick = () => {
      selectedSize = s;
      renderSizes();
      renderPrice();
    };
    row.appendChild(btn);
  });
}

function currentPrice() {
  if (selectedSize && selectedSize.price) {
    return { reg: selectedSize.price, disc: selectedSize.discountPrice || null };
  }
  if (selectedColor && selectedColor.price) {
    return { reg: selectedColor.price, disc: selectedColor.discountPrice || null };
  }
  return { reg: product.regularPrice || 0, disc: product.discountPrice || null };
}

function renderPrice() {
  const p = currentPrice();
  const box = document.getElementById("priceBox");
  let html = `<span class="price-reg">৳${p.reg}</span>`;
  if (p.disc && p.disc > 0 && p.disc < p.reg) {
    html += `<span class="price-disc">৳${p.disc}</span>`;
    const pct = Math.round(((p.reg - p.disc) / p.reg) * 100);
    html += `<span class="discount-badge">-${pct}%</span>`;
  }
  box.innerHTML = html;
}

function renderDesc() {
  document.getElementById("productDesc").innerText = product.description || "";
}

function renderPaymentChoice() {
  const box = document.getElementById("paymentChoice");
  const codOk = product.codAvailable !== false;
  let html = "";
  if (codOk) {
    html += `<label class="pay-label"><input type="radio" name="payMethod" value="COD" checked> ক্যাশ অন ডেলিভারি</label>`;
  }
  html += `<label class="pay-label"><input type="radio" name="payMethod" value="bKash" ${!codOk ? "checked" : ""}> বিকাশ</label>`;
  box.innerHTML = html;
  
  // Update bkash UI when changed
  box.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("change", () => {
      document.getElementById("bkashBox").style.display = inp.value === "bKash" ? "block" : "none";
    });
  });
}

document.getElementById("closeModalBtn").onclick = () => {
  document.getElementById("orderModal").style.display = "none";
  document.getElementById("orderFormView").style.display = "block";
  document.getElementById("orderSuccessView").style.display = "none";
};

document.getElementById("closeSuccessBtn").onclick = () => {
  document.getElementById("orderModal").style.display = "none";
  document.getElementById("orderFormView").style.display = "block";
  document.getElementById("orderSuccessView").style.display = "none";
};

document.getElementById("orderBtn").onclick = () => {
  document.getElementById("orderModal").style.display = "flex";
  updateSummary();
};

// Delivery zone change
document.querySelectorAll('input[name="deliveryZone"]').forEach(r => {
  r.addEventListener("change", updateSummary);
});

function updateSummary() {
  const zoneVal = document.querySelector('input[name="deliveryZone"]:checked')?.value || "80";
  const deliveryCharge = parseInt(zoneVal, 10) || 80;
  const p = currentPrice();
  const total = (p.reg || 0) + deliveryCharge;
  const box = document.getElementById("orderSummaryBox");
  box.innerHTML = `
    <div class="summary-row"><span>পণ্যের দাম</span><span>৳${p.reg}</span></div>
    <div class="summary-row"><span>ডেলিভারি</span><span>৳${deliveryCharge}</span></div>
    <div class="summary-row total"><span>মোট</span><span>৳${total}</span></div>
  `;
}

document.getElementById("submitOrderBtn").onclick = async () => {
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const district = document.getElementById("custDistrict").value.trim();
  const thana = document.getElementById("custThana").value.trim();
  const village = document.getElementById("custVillage").value.trim();
  const payMethod = document.querySelector('input[name="payMethod"]:checked')?.value || (product.codAvailable !== false ? "COD" : "bKash");
  const zoneVal = document.querySelector('input[name="deliveryZone"]:checked')?.value || "80";
  const deliveryCharge = parseInt(zoneVal, 10) || 80;

  if (!name || !phone || !district || !thana || !village) {
    alert("সব ঘর পূরণ করুন।");
    return;
  }

  const p = currentPrice();
  const orderId = generateOrderId();
  const orderData = {
    productId: product.id,
    productTitle: product.title,
    customerName: name,
    customerPhone: phone,
    district,
    thana,
    village,
    address: `${village}, ${thana}, ${district}`,
    color: selectedColor ? selectedColor.name : "",
    size: selectedSize ? selectedSize.name : "",
    price: p.reg,
    discountPrice: p.disc || null,
    deliveryCharge,
    paymentMethod: payMethod,
    orderId,
    status: "pending",
    createdAt: new Date()
  };

  try {
    await db.collection("orders").add(orderData);

    // Show success
    document.getElementById("orderFormView").style.display = "none";
    document.getElementById("orderSuccessView").style.display = "block";
    document.getElementById("generatedOrderId").innerText = orderId;
    document.getElementById("trackNowLink").href = `track.html?id=${orderId}`;

    // Optional EmailJS (if configured)
    try {
      if (SITE_CONFIG.emailjsServiceId !== "YOUR_SERVICE_ID") {
        emailjs.send(SITE_CONFIG.emailjsServiceId, SITE_CONFIG.emailjsTemplateId, {
          product_name: product.title,
          color: selectedColor ? selectedColor.name : "",
          size: selectedSize ? selectedSize.name : "",
          price: p.reg,
          customer_name: name,
          customer_phone: phone,
          customer_address: orderData.address,
          payment_method: payMethod
        }, SITE_CONFIG.emailjsPublicKey);
      }
    } catch (e) {
      // ignore email errors
    }
  } catch (err) {
    alert("অর্ডার পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
  }
};

document.getElementById("addCartBtn").onclick = () => {
  alert("কার্ট ফিচার скоро আসছে!");
};

let selectedStars = 0;

function setupStarPicker() {
  const stars = document.querySelectorAll("#starPicker span");
  stars.forEach(s => {
    s.onclick = () => {
      selectedStars = parseInt(s.dataset.val, 10);
      stars.forEach(st => {
        st.innerText = parseInt(st.dataset.val, 10) <= selectedStars ? "★" : "☆";
      });
    };
  });
}

window.submitReview = async () => {
  const name = document.getElementById("reviewName").value.trim();
  const comment = document.getElementById("reviewComment").value.trim();
  if (!name) return alert("নাম লিখুন");
  if (selectedStars === 0) return alert("স্টার বাছাই করুন");
  if (!comment) return alert("মতামত লিখুন");

  try {
    await db.collection("reviews").add({
      productId: product.id,
      name,
      stars: selectedStars,
      comment,
      createdAt: new Date()
    });
    document.getElementById("reviewName").value = "";
    document.getElementById("reviewComment").value = "";
    selectedStars = 0;
    document.querySelectorAll("#starPicker span").forEach(st => st.innerText = "☆");
    alert("রিভিউ জমা হয়েছে! ধন্যবাদ।");
    renderReviewList();
  } catch (e) {
    alert("রিভিউ জমা দিতে সমস্যা হয়েছে।");
  }
};

async function renderReviewList() {
  const list = document.getElementById("reviewList");
  list.innerHTML = "লোড হচ্ছে...";
  try {
    const snap = await db.collection("reviews").where("productId","==",product.id).get();
    if (snap.empty) {
      list.innerHTML = "<p>এখনো কোনো রিভিউ নেই। প্রথম রিভিউ আপনিই দিন!</p>";
      setupStarPicker();
      return;
    }
    let totalStars = 0;
    let html = "";
    const reviews = [];
    snap.forEach(doc => reviews.push(doc.data()));
    reviews.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

    reviews.forEach(r => {
      totalStars += r.stars || 0;
      const starsText = "★".repeat(r.stars||0) + "☆".repeat(5-(r.stars||0));
      html += `
        <div style="padding:10px 0; border-bottom:1px solid #eee;">
          <strong>${r.name}</strong>
          <div style="color:#f5a623; font-size:18px;">${starsText}</div>
          <p style="margin:4px 0 0; color:#555;">${r.comment}</p>
        </div>
      `;
    });

    const avg = (totalStars / reviews.length).toFixed(1);
    html = `<div style="margin-bottom:10px; font-weight:bold;">গড় রেটিং: ${avg} ⭐ (${reviews.length} জন রিভিউ দিয়েছেন)</div>` + html;
    list.innerHTML = html;
    setupStarPicker();
  } catch (e) {
    list.innerHTML = "<p>রিভিউ লোড করা যায়নি।</p>";
    setupStarPicker();
  }
}

function renderRelated() {
  // Placeholder for Phase 2 feature 4/6
  document.getElementById("relatedGrid").innerHTML = "<p>আরও পণ্য শীঘ্রই যোগ করা হবে।</p>";
}

window.onload = () => {
  loadProduct();
  renderReviewList();
  renderRelated();
  // Load bKash info for modal display
  db.collection("settings").doc("bkash").get().then(snap => {
    if (snap.exists) {
      const d = snap.data();
      document.getElementById("bkashNumberText").innerText = d.number || "";
      document.getElementById("bkashQrImg").src = d.qrUrl || "";
    } else {
      document.getElementById("bkashNumberText").innerText = SITE_CONFIG.whatsappNumber || "";
    }
  });
};
