import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.getElementById("loginBtn").onclick = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const errEl = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");

  if(!email || !password){ errEl.textContent = "ইমেইল ও পাসওয়ার্ড দিন"; return; }

  btn.disabled = true;
  btn.textContent = "চেক করা হচ্ছে...";

  try{
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "admin.html";
  }catch(e){
    errEl.textContent = "ভুল ইমেইল বা পাসওয়ার্ড!";
    btn.disabled = false;
    btn.textContent = "লগইন করুন";
  }
};
