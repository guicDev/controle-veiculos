let modoAtual = null;

function apiUrl(url) {
  const separador = url.includes("?") ? "&" : "?";
  return `${url}${separador}_=${Date.now()}`;
}

async function carregarVeiculos() {
  try {
    const [veiRes, movRes, motRes] = await Promise.all([
      fetch(apiUrl("/api/veiculos"), { cache: "no-store" }),
      fetch(apiUrl("/api/movimentacoes"), { cache: "no-store" }),
      fetch(apiUrl("/api/motoristas"), { cache: "no-store" })
    ]);

    const veiculos = await veiRes.json();
    const movimentacoes = await movRes.json();
    const motoristas = await motRes.json();

    const container = document.getElementById("cards");
    container.innerHTML = "";

    veiculos.forEach(v => {
      const card = document.createElement("div");
      card.className = "card";

      const foto = v.foto && v.foto.trim() !== ""
        ? v.foto
        : "https://via.placeholder.com/400x200?text=Ve%C3%ADculo";

      const movAtivo = movimentacoes.find(
        m => Number(m.veiculoId) === Number(v.id) && m.status === "em uso"
      );

      let infoUso = "";

      if (movAtivo) {
        const motorista = motoristas.find(m => Number(m.id) === Number(movAtivo.motoristaId));

        infoUso = `
          <p><strong>Motorista:</strong> ${motorista ? motorista.nome : "N/A"}</p>
          <p><strong>Saída:</strong> ${movAtivo.dataSaida || "-"}</p>
        `;
      }

      card.innerHTML = `
        <img src="${foto}" alt="${v.nome}">
        <div class="card-content">
          <h3>${v.nome}</h3>
          <p><strong>Placa:</strong> ${v.placa}</p>
          <p><strong>Tipo:</strong> ${v.tipo}</p>

          <span class="status ${v.status === "em uso" ? "em-uso" : "disponivel"}">
            ${v.status}
          </span>

          ${infoUso}

          ${
            v.status === "disponivel"
              ? `<button class="btn-retirar" onclick="abrirModalRetirada(${v.id}, '${String(v.nome).replace(/'/g, "\\'")}')">Retirar</button>`
              : `<button class="btn-devolver" onclick="abrirModalDevolucao(${v.id}, '${String(v.nome).replace(/'/g, "\\'")}')">Devolver</button>`
          }
        </div>
      `;

      container.appendChild(card);
    });
  } catch (error) {
    console.error("Erro ao carregar veículos:", error);
    alert("Erro ao carregar veículos.");
  }
}

async function abrirModalRetirada(veiculoId, veiculoNome) {
  modoAtual = "retirada";

  document.getElementById("modalTitulo").textContent = "Registrar Retirada";
  document.getElementById("btnConfirmarModal").textContent = "Confirmar Retirada";
  document.getElementById("veiculoIdSelecionado").value = veiculoId;
  document.getElementById("veiculoNome").value = veiculoNome;
  document.getElementById("observacao").value = "";
  document.getElementById("movimentacaoId").value = "";
  document.getElementById("blocoMotorista").style.display = "block";

  limparAssinatura();
  await carregarMotoristasNoSelect();

  document.getElementById("modal").classList.remove("hidden");
}

async function abrirModalDevolucao(veiculoId, veiculoNome) {
  modoAtual = "devolucao";

  document.getElementById("modalTitulo").textContent = "Registrar Devolução";
  document.getElementById("btnConfirmarModal").textContent = "Confirmar Devolução";
  document.getElementById("veiculoIdSelecionado").value = veiculoId;
  document.getElementById("veiculoNome").value = veiculoNome;
  document.getElementById("observacao").value = "";
  document.getElementById("blocoMotorista").style.display = "none";

  const movimentacoes = await fetch(apiUrl("/api/movimentacoes"), { cache: "no-store" }).then(r => r.json());
  const atual = movimentacoes.find(
    m => Number(m.veiculoId) === Number(veiculoId) && m.status === "em uso"
  );

  if (!atual) {
    alert("Movimentação em uso não encontrada.");
    return;
  }

  document.getElementById("movimentacaoId").value = atual.id;

  limparAssinatura();
  document.getElementById("modal").classList.remove("hidden");
}

function fecharModal() {
  document.getElementById("modal").classList.add("hidden");
}

async function carregarMotoristasNoSelect() {
  const res = await fetch(apiUrl("/api/motoristas"), { cache: "no-store" });
  const motoristas = await res.json();

  const select = document.getElementById("motoristaSelect");
  select.innerHTML = "";

  if (!motoristas.length) {
    select.innerHTML = `<option value="">Nenhum motorista cadastrado</option>`;
    return;
  }

  motoristas.forEach(m => {
    const option = document.createElement("option");
    option.value = m.id;
    option.textContent = `${m.nome} - ${m.matricula}`;
    select.appendChild(option);
  });
}

async function confirmarAcao() {
  try {
    const tipo = document.getElementById("modalTitulo").innerText;
    const veiculoId = Number(document.getElementById("veiculoIdSelecionado").value);
    const movimentacaoId = Number(document.getElementById("movimentacaoId").value);
    const observacao = document.getElementById("observacao").value.trim();

    const assinatura = obterAssinaturaBase64();

    if (!assinatura || assinatura.length < 2000) {
      alert("Faça a assinatura antes de confirmar.");
      return;
    }

    if (tipo.includes("Devolução")) {
      const res = await fetch(apiUrl("/api/devolucao"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify({
          id: movimentacaoId,
          veiculoId,
          dataChegada: new Date().toLocaleString("pt-BR"),
          observacaoChegada: observacao,
          assinaturaChegada: assinatura
        })
      });

      const resultado = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert("❌ " + (resultado.erro || "Erro ao devolver veículo"));
        return;
      }

      alert("✅ Devolução registrada com sucesso");
      fecharModal();

      setTimeout(async () => {
        await carregarVeiculos();
      }, 300);

      return;
    }

    const motoristaId = Number(document.getElementById("motoristaSelect").value);

    if (!motoristaId) {
      alert("Selecione um motorista.");
      return;
    }

    const res = await fetch(apiUrl("/api/retirada"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        veiculoId,
        motoristaId,
        dataSaida: new Date().toLocaleString("pt-BR"),
        observacaoSaida: observacao,
        assinaturaSaida: assinatura
      })
    });

    const resultado = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert("❌ " + (resultado.erro || "Erro ao retirar veículo"));
      return;
    }

    alert("✅ Retirada registrada com sucesso");
    fecharModal();

    setTimeout(async () => {
      await carregarVeiculos();
    }, 300);

  } catch (error) {
    console.error("Erro ao confirmar ação:", error);
    alert("❌ Erro ao confirmar operação.");
  }
}

async function fazerBackup() {
  const confirmar = confirm("Deseja gerar um backup agora?");
  if (!confirmar) return;

  try {
    const res = await fetch(apiUrl("/api/backup"), {
      method: "POST",
      cache: "no-store"
    });

    const resultado = await res.json();

    if (!res.ok) {
      alert("❌ " + (resultado.erro || "Erro ao gerar backup"));
      return;
    }

    alert("✅ Backup gerado com sucesso");
  } catch (error) {
    console.error(error);
    alert("❌ Erro ao gerar backup");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  carregarVeiculos();
});