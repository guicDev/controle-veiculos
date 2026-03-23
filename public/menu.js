const links = document.querySelectorAll(".menu a");

const paginaAtual = window.location.pathname.split("/").pop();

links.forEach(link => {
  const href = link.getAttribute("href");

  if (href === paginaAtual || (paginaAtual === "" && href === "index.html")) {
    link.classList.add("ativo");
  }
});