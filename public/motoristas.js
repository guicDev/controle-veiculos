async function carregarMotoristas() {
  const res = await fetch("/api/motoristas");
  const motoristas = await res.json();

  const lista = document.getElementById("listaMotoristas");
  lista.innerHTML = "";

  motoristas.forEach(m => {
    const div = document.createElement("div");
    div.className = "item-lista";

    div.innerHTML = `
      <strong>${m.nome}</strong> - ${m.matricula} (${m.setor})<br><br>

      <div>
        <button onclick="editarMotorista(${m.id}, '${m.nome}', '${m.matricula}', '${m.setor}')">
          Editar
        </button>

        <button onclick="excluirMotorista(${m.id})">
          Excluir
        </button>
      </div>
    `;

    lista.appendChild(div);
  });
}

document.getElementById("formMotorista").addEventListener("submit", async e => {
  e.preventDefault();

  const id = document.getElementById("motoristaId").value;

  const data = {
    nome: document.getElementById("nome").value,
    matricula: document.getElementById("matricula").value,
    setor: document.getElementById("setor").value
  };

  let url = "/api/motoristas";
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
    mostrarErro(resultado.erro || "Erro ao salvar motorista");
    return;
  }

  mostrarSucesso("Motorista salvo com sucesso");

  document.getElementById("formMotorista").reset();
  document.getElementById("motoristaId").value = "";

  carregarMotoristas();
});

async function excluirMotorista(id) {
  if (!confirm("Tem certeza que deseja excluir este motorista?")) return;

  const res = await fetch("/api/motoristas/" + id, {
    method: "DELETE"
  });

  const resultado = await res.json();

  if (!res.ok) {
    mostrarErro(resultado.erro);
    return;
  }

  mostrarSucesso("Motorista excluído com sucesso");
  carregarMotoristas();
}

function editarMotorista(id, nome, matricula, setor) {
  document.getElementById("motoristaId").value = id;
  document.getElementById("nome").value = nome;
  document.getElementById("matricula").value = matricula;
  document.getElementById("setor").value = setor;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ===== MENSAGENS ===== */

function mostrarErro(msg) {
  alert("❌ " + msg);
}

function mostrarSucesso(msg) {
  alert("✅ " + msg);
}

carregarMotoristas();