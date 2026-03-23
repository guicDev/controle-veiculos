function extrairDataBR(dataTexto) {
  if (!dataTexto) return "";

  const match = String(dataTexto).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return "";

  const [, dia, mes, ano] = match;
  return `${ano}-${mes}-${dia}`;
}

function estaNoPeriodo(dataISO, dataInicial, dataFinal) {
  if (!dataISO) return false;

  if (dataInicial && dataISO < dataInicial) return false;
  if (dataFinal && dataISO > dataFinal) return false;

  return true;
}

async function carregarHistorico() {
  try {
    const [movRes, veiRes, motRes] = await Promise.all([
      fetch("/api/movimentacoes"),
      fetch("/api/veiculos"),
      fetch("/api/motoristas")
    ]);

    const movimentacoes = await movRes.json();
    const veiculos = await veiRes.json();
    const motoristas = await motRes.json();

    const filtroTexto = document.getElementById("filtroTexto")
      ? document.getElementById("filtroTexto").value.toLowerCase().trim()
      : "";

    const filtroStatus = document.getElementById("filtroStatus")
      ? document.getElementById("filtroStatus").value
      : "";

    const filtroDataInicial = document.getElementById("filtroDataInicial")
      ? document.getElementById("filtroDataInicial").value
      : "";

    const filtroDataFinal = document.getElementById("filtroDataFinal")
      ? document.getElementById("filtroDataFinal").value
      : "";

    const lista = document.getElementById("listaHistorico");
    lista.innerHTML = "";

    const dados = movimentacoes.map(m => {
      const v = veiculos.find(x => x.id === m.veiculoId);
      const mt = motoristas.find(x => x.id === m.motoristaId);

      return {
        ...m,
        veiculo: v?.nome || "Veículo removido",
        placa: v?.placa || "-",
        motorista: mt?.nome || "Motorista removido",
        dataSaidaISO: extrairDataBR(m.dataSaida),
        dataChegadaISO: extrairDataBR(m.dataChegada)
      };
    });

    const filtrados = dados
      .filter(item => {
        const textoCombinado = `${item.veiculo} ${item.placa} ${item.motorista}`.toLowerCase();

        const passaTexto = !filtroTexto || textoCombinado.includes(filtroTexto);
        const passaStatus = !filtroStatus || item.status === filtroStatus;

        let passaPeriodo = true;

        if (filtroDataInicial || filtroDataFinal) {
          const saidaNoPeriodo = estaNoPeriodo(item.dataSaidaISO, filtroDataInicial, filtroDataFinal);
          const chegadaNoPeriodo = estaNoPeriodo(item.dataChegadaISO, filtroDataInicial, filtroDataFinal);
          passaPeriodo = saidaNoPeriodo || chegadaNoPeriodo;
        }

        return passaTexto && passaStatus && passaPeriodo;
      })
      .sort((a, b) => b.id - a.id);

    if (!filtrados.length) {
      lista.innerHTML = `<div class="item-lista">Nenhum registro encontrado.</div>`;
      return;
    }

    filtrados.forEach(item => {
      const div = document.createElement("div");
      div.className = "item-lista";

      div.innerHTML = `
        <strong>${item.veiculo}</strong> - ${item.placa}<br>
        <strong>Motorista:</strong> ${item.motorista}<br>
        <strong>Saída:</strong> ${item.dataSaida || "-"}<br>
        <strong>Devolução:</strong> ${item.dataChegada || "-"}<br>
        <strong>Status:</strong> ${item.status || "-"}<br>
        <strong>Obs. saída:</strong> ${item.observacaoSaida || "-"}<br>
        <strong>Obs. devolução:</strong> ${item.observacaoChegada || "-"}<br><br>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button onclick="abrirPdf(${item.id})">Ver PDF</button>
        </div>
      `;

      lista.appendChild(div);
    });
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
    const lista = document.getElementById("listaHistorico");
    if (lista) {
      lista.innerHTML = `<div class="item-lista">Erro ao carregar histórico.</div>`;
    }
  }
}

function limparFiltros() {
  const filtroTexto = document.getElementById("filtroTexto");
  const filtroStatus = document.getElementById("filtroStatus");
  const filtroDataInicial = document.getElementById("filtroDataInicial");
  const filtroDataFinal = document.getElementById("filtroDataFinal");

  if (filtroTexto) filtroTexto.value = "";
  if (filtroStatus) filtroStatus.value = "";
  if (filtroDataInicial) filtroDataInicial.value = "";
  if (filtroDataFinal) filtroDataFinal.value = "";

  carregarHistorico();
}

function abrirPdf(id) {
  window.open(`/api/comprovante/${id}`, "_blank");
}

document.addEventListener("DOMContentLoaded", () => {
  const filtroTexto = document.getElementById("filtroTexto");
  const filtroStatus = document.getElementById("filtroStatus");
  const filtroDataInicial = document.getElementById("filtroDataInicial");
  const filtroDataFinal = document.getElementById("filtroDataFinal");

  if (filtroTexto) {
    filtroTexto.addEventListener("keyup", event => {
      if (event.key === "Enter") carregarHistorico();
    });
  }

  if (filtroStatus) {
    filtroStatus.addEventListener("change", carregarHistorico);
  }

  if (filtroDataInicial) {
    filtroDataInicial.addEventListener("change", carregarHistorico);
  }

  if (filtroDataFinal) {
    filtroDataFinal.addEventListener("change", carregarHistorico);
  }

  carregarHistorico();
});