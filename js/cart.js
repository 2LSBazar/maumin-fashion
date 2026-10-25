export function addToCart(product, selectedColor, selectedSize) {
  const existing = JSON.parse(localStorage.getItem("mauminCart") || "[]");
  const item = {
    id: product.id,
    title: product.title,
    img: (selectedColor && selectedColor.images && selectedColor.images[0]) ? selectedColor.images[0] : (product.images && product.images[0] ? product.images[0] : ""),
    color: selectedColor ? selectedColor.name : "",
    size: selectedSize ? selectedSize.name : "",
    price: (function(){
      if(selectedSize && selectedSize.price) return selectedSize.price;
      if(selectedColor && selectedColor.price) return selectedColor.price;
      return product.regularPrice || 0;
    })()
  };
  existing.push(item);
  localStorage.setItem("mauminCart", JSON.stringify(existing));
  alert("কার্টে যোগ হয়েছে! 🛒");
  window.location.href = "cart.html";
}
