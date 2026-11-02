/* Rellena los datos de contacto de las páginas legales a partir de lib/manifest.js */
(function(){
  var B = window.__BRAND__ || {};
  if (B.contactEmail) document.querySelectorAll("[data-email]").forEach(function(el){
    var a = document.createElement("a"); a.href = "mailto:" + B.contactEmail; a.textContent = B.contactEmail; el.replaceWith(a);
  });
  if (B.whatsapp) document.querySelectorAll("[data-wa]").forEach(function(el){
    var a = document.createElement("a"); a.href = "https://wa.me/" + B.whatsapp;
    a.textContent = "+" + B.whatsapp.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4"); el.replaceWith(a);
  });
  if (B.siteUrl) document.querySelectorAll("[data-site]").forEach(function(el){ el.textContent = B.siteUrl.replace(/^https?:\/\//, ""); });
})();
