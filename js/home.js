import { db } from "./firebase-config.js";
import { SITE_CONFIG } from "./site-config.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Splash screen hide after 1.3s
window.addEventListener("load", () => {
  setTimeout(() => {
    document.getElementById("splash").classList.add("hide");
  }, 1300);
});

// WhatsApp floating button link
document.getElementById("whatsappFloat").href = `https://wa.me/${SITE_CONFIG.whatsappNumber}`;

// Sidebar toggle
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
document.getElementById("menuBtn").onclick = () => {
  sidebar.classList.add("open");
  overlay.classList.add("show");
};
overlay.onclick = () => {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
};

let allProducts = [];
let allCategories = [];
let currentCat = "all";

// Load Banners
async function loadBanners(){
  try{
    const snap = await getDoc(doc(db,"settings","homepage"));
    const wrap = document.getElementById("bannerWrap");
    if(snap.exists() && snap.data().bannerImages?.length){
      const imgs = snap.data().bannerImages;
      imgs.forEach((url,i)=>{
        const img = document.createElement("img");
        img.src = url;
        if(i===0) img.classList.add("active");
        wrap.appendChild(img);
      });
      let idx=0;
      if(imgs.length>1){
        setInterval(()=>{
          const imgEls = wrap.querySelectorAll("img");
          imgEls[idx].classList.remove("active");
          idx = (idx+1) % imgEls.length;
          imgEls[idx].classList.add("active");
        },3000);
      }
    } else {
      wrap.style.display="none";
    }
  }catch(e){ document.getElementById("bannerWrap").style.display="none"; }
}

// Load Categories
async function loadCategories(){
  const snap = await getDocs(collection(db,"categories"));
  allCategories = [];
  snap.forEach(d => allCategories.push({id:d.id, ...d.data()}));

  const catScroll = document.getElementById("catScroll");
  const sideList = document.getElementById("sidebarCatList");

  allCategories.forEach(cat=>{
    const chip = document.createElement("div");
    chip.className="cat-chip";
    chip.dataset.cat = cat.id;
    chip.textContent = cat.name;
    chip.onclick = ()=> filterByCategory(cat.id);
    catScroll.appendChild(chip);

    const li = document.createElement("li");
    li.textContent = cat.name;
    li.dataset.cat = cat.id;
    li.onclick = ()=>{
      filterByCategory(cat.id);
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
    };
    sideList.appendChild(li);
  });

  document.querySelector('.cat-chip[data-cat="all"]').onclick = ()=>filterByCategory("all");
  document.querySelector('#sidebarCatList li[data-cat="all"]').onclick = ()=>{
    filterByCategory("all");
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  };
}

function filterByCategory(catId){
  currentCat = catId;
  document.querySelectorAll(".cat-chip").forEach(c=>c.classList.remove("active"));
  const activeChip = document.querySelector(`.cat-chip[data-cat="${catId}"]`);
  if(activeChip) activeChip.classList.add("active");
  renderProducts();
}

// Load Products
async function loadProducts(){
  const snap = await getDocs(collection(db,"products"));
  allProducts = [];
  snap.forEach(d => allProducts.push({id:d.id, ...d.data()}));
  renderProducts();
}

function renderProducts(){
  const grid = document.getElementById("productGrid");
  const searchVal = document.getElementById("searchInput").value.toLowerCase();

  let filtered = allProducts.filter(p=>{
    const matchCat = currentCat==="all" || p.categoryId===currentCat;
    const matchSearch = !searchVal || p.title.toLowerCase().includes(searchVal);
    return matchCat && matchSearch;
  });

  grid.innerHTML = "";
  if(filtered.length===0){
    grid.innerHTML = `<p class="empty-msg">কোনো পণ্য পাওয়া যায়নি</p>`;
    return;
  }

  filtered.forEach(p=>{
    const img = (p.images && p.images[0]) || "assets/logo.png";
    const hasDiscount = p.discountPrice && p.discountPrice < p.regularPrice;
    const percent = hasDiscount ? Math.round(((p.regularPrice-p.discountPrice)/p.regularPrice)*100) : 0;

    const card = document.createElement("a");
    card.href = `product.html?id=${p.id}`;
    card.className = "card";
    card.innerHTML = `
      <span class="cat-tag">${p.categoryName || ""}</span>
      <img src="${img}" alt="${p.title}">
      <div class="info">
        <div class="title">${p.title}</div>
        <div class="price">
          ${hasDiscount ? `<span class="regular">৳${p.regularPrice}</span>
          <span class="discount">৳${p.discountPrice}</span>
          <span class="percent">-${percent}%</span>` 
          : `<span class="discount">৳${p.regularPrice}</span>`}
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

document.getElementById("searchInput").addEventListener("input", renderProducts);

loadBanners();
loadCategories();
loadProducts();
