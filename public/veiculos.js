async function carregarVeiculos() {
  const res = await fetch("/api/veiculos");
  const veiculos = await res.json();

  const lista = document.getElementById("listaVeiculos");
  lista.innerHTML = "";

  veiculos.forEach(v => {
    const div = document.createElement("div");
    div.className = "item-lista";

    div.innerHTML = `
      <strong>${v.nome}</strong> - ${v.placa} (${v.tipo})<br><br>

      <div>
        <button onclick="editarVeiculo(${v.id}, '${v.nome}', '${v.placa}', '${v.tipo}', '${v.foto || ""}')">
          Editar
        </button>

        <button onclick="excluirVeiculo(${v.id})">
          Excluir
        </button>
      </div>
    `;

    lista.appendChild(div);
  });
}

document.getElementById("formVeiculo").addEventListener("submit", async e => {
  e.preventDefault();

  const id = document.getElementById("veiculoId").value;

  const data = {
    nome: document.getElementById("nome").value,
    placa: document.getElementById("placa").value,
    tipo: document.getElementById("tipo").value,
    foto: document.getElementById("foto").value
  };

  let url = "/api/veiculos";
  let method = "POST";

  if (id) {
    url += "/" + id;
    method = "PUT";
  }

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const resultado = await res.json();

  if (!res.ok) {
    mostrarErro(resultado.erro || "Erro ao salvar veículo");
    return;
  }

  mostrarSucesso("Veículo salvo com sucesso");

  document.getElementById("formVeiculo").reset();
  document.getElementById("veiculoId").value = "";

  carregarVeiculos();
});

async function excluirVeiculo(id) {
  if (!confirm("Tem certeza que deseja excluir este veículo?")) return;

  const res = await fetch("/api/veiculos/" + id, {
    method: "DELETE"
  });

  const resultado = await res.json();

  if (!res.ok) {
    mostrarErro(resultado.erro);
    return;
  }

  mostrarSucesso("Veículo excluído com sucesso");
  carregarVeiculos();
}

function editarVeiculo(id, nome, placa, tipo, foto) {
  document.getElementById("veiculoId").value = id;
  document.getElementById("nome").value = nome;
  document.getElementById("placa").value = placa;
  document.getElementById("tipo").value = tipo;
  document.getElementById("foto").value = foto;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ===== MENSAGENS ===== */

function mostrarErro(msg) {
  alert("❌ " + msg);
}

function mostrarSucesso(msg) {
  alert("✅ " + msg);
}

carregarVeiculos();