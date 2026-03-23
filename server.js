const express = require("express");
const path = require("path");
const fs = require("fs-extra");
const PDFDocument = require("pdfkit");
const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 3001;

const dataDir = path.join(__dirname, "data");
const veiculosFile = path.join(dataDir, "veiculos.json");
const motoristasFile = path.join(dataDir, "motoristas.json");
const movimentacoesFile = path.join(dataDir, "movimentacoes.json");
const logoFile = path.join(__dirname, "public", "img", "logo.png");

// ajuste o caminho se necessário
const backupBaseDir = "\\\\192.168.15.54\\servidor2\\BACKUP_CONTROLE_VEICULOS";

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// impedir cache em tudo que é HTML e API
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.endsWith(".html") || req.path === "/") {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
  }
  next();
});

app.use(express.static(path.join(__dirname, "public"), {
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  }
}));

function agoraFormatado() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  const hora = String(agora.getHours()).padStart(2, "0");
  const minuto = String(agora.getMinutes()).padStart(2, "0");
  const segundo = String(agora.getSeconds()).padStart(2, "0");

  return `${ano}-${mes}-${dia}_${hora}-${minuto}-${segundo}`;
}

async function criarBackup() {
  const timestamp = agoraFormatado();
  const pastaBackup = path.join(backupBaseDir, `backup_${timestamp}`);

  await fs.ensureDir(backupBaseDir);
  await fs.ensureDir(pastaBackup);

  await fs.copy(veiculosFile, path.join(pastaBackup, "veiculos.json"));
  await fs.copy(motoristasFile, path.join(pastaBackup, "motoristas.json"));
  await fs.copy(movimentacoesFile, path.join(pastaBackup, "movimentacoes.json"));

  return pastaBackup;
}

async function limparBackupsAntigos(dias = 30) {
  try {
    await fs.ensureDir(backupBaseDir);

    const itens = await fs.readdir(backupBaseDir);
    const agora = Date.now();
    const limite = dias * 24 * 60 * 60 * 1000;

    for (const item of itens) {
      const caminho = path.join(backupBaseDir, item);
      const stat = await fs.stat(caminho);

      if (!stat.isDirectory()) continue;

      if (agora - stat.mtimeMs > limite) {
        await fs.remove(caminho);
        console.log(`Backup removido por antiguidade: ${caminho}`);
      }
    }
  } catch (error) {
    console.error("Erro ao limpar backups antigos:", error);
  }
}

function agendarBackups() {
  cron.schedule("0 18 * * *", async () => {
    try {
      console.log("Executando backup automático na pasta da rede...");
      const destino = await criarBackup();
      console.log(`Backup automático criado em: ${destino}`);
      await limparBackupsAntigos(30);
    } catch (error) {
      console.error("Erro no backup automático:", error);
    }
  });
}

async function init() {
  await fs.ensureDir(dataDir);

  if (!(await fs.pathExists(veiculosFile))) {
    await fs.writeJson(veiculosFile, [], { spaces: 2 });
  }

  if (!(await fs.pathExists(motoristasFile))) {
    await fs.writeJson(motoristasFile, [], { spaces: 2 });
  }

  if (!(await fs.pathExists(movimentacoesFile))) {
    await fs.writeJson(movimentacoesFile, [], { spaces: 2 });
  }

  await fs.ensureDir(backupBaseDir);
}

app.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   BACKUP MANUAL
========================= */

app.post("/api/backup", async (req, res) => {
  try {
    const destino = await criarBackup();
    await limparBackupsAntigos(30);

    res.json({
      ok: true,
      mensagem: "Backup criado com sucesso.",
      destino
    });
  } catch (error) {
    console.error("Erro ao criar backup manual:", error);
    res.status(500).json({
      erro: "Erro ao criar backup. Verifique se a pasta da rede existe e se há permissão de escrita."
    });
  }
});

/* =========================
   VEÍCULOS
========================= */

app.get("/api/veiculos", async (req, res) => {
  try {
    const veiculos = await fs.readJson(veiculosFile);
    res.json(veiculos);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao listar veículos." });
  }
});

app.post("/api/veiculos", async (req, res) => {
  try {
    const { nome, placa, tipo, foto } = req.body;

    if (!nome || !placa || !tipo) {
      return res.status(400).json({ erro: "Nome, placa e tipo são obrigatórios." });
    }

    const veiculos = await fs.readJson(veiculosFile);

    const placaJaExiste = veiculos.some(
      v => String(v.placa).trim().toLowerCase() === String(placa).trim().toLowerCase()
    );

    if (placaJaExiste) {
      return res.status(400).json({ erro: "Já existe um veículo cadastrado com essa placa." });
    }

    const novoVeiculo = {
      id: Date.now(),
      nome: String(nome).trim(),
      placa: String(placa).trim(),
      tipo: String(tipo).trim(),
      foto: foto ? String(foto).trim() : "",
      status: "disponivel"
    };

    veiculos.push(novoVeiculo);
    await fs.writeJson(veiculosFile, veiculos, { spaces: 2 });

    res.json({ ok: true, veiculo: novoVeiculo });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao cadastrar veículo." });
  }
});

app.put("/api/veiculos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome, placa, tipo, foto } = req.body;

    let veiculos = await fs.readJson(veiculosFile);
    const index = veiculos.findIndex(v => v.id === id);

    if (index === -1) {
      return res.status(404).json({ erro: "Veículo não encontrado." });
    }

    const placaJaExiste = veiculos.some(
      v =>
        v.id !== id &&
        String(v.placa).trim().toLowerCase() === String(placa).trim().toLowerCase()
    );

    if (placaJaExiste) {
      return res.status(400).json({ erro: "Já existe outro veículo cadastrado com essa placa." });
    }

    veiculos[index] = {
      ...veiculos[index],
      nome: String(nome).trim(),
      placa: String(placa).trim(),
      tipo: String(tipo).trim(),
      foto: foto ? String(foto).trim() : ""
    };

    await fs.writeJson(veiculosFile, veiculos, { spaces: 2 });
    res.json({ ok: true, veiculo: veiculos[index] });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao editar veículo." });
  }
});

app.delete("/api/veiculos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    let veiculos = await fs.readJson(veiculosFile);
    const movimentacoes = await fs.readJson(movimentacoesFile);

    const veiculo = veiculos.find(v => v.id === id);

    if (!veiculo) {
      return res.status(404).json({ erro: "Veículo não encontrado." });
    }

    const temMovimentacao = movimentacoes.some(m => m.veiculoId === id);

    if (temMovimentacao) {
      return res.status(400).json({
        erro: "Este veículo já possui movimentações registradas e não pode ser excluído."
      });
    }

    if (veiculo.status === "em uso") {
      return res.status(400).json({
        erro: "Este veículo está em uso e não pode ser excluído."
      });
    }

    veiculos = veiculos.filter(v => v.id !== id);
    await fs.writeJson(veiculosFile, veiculos, { spaces: 2 });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao excluir veículo." });
  }
});

/* =========================
   MOTORISTAS
========================= */

app.get("/api/motoristas", async (req, res) => {
  try {
    const motoristas = await fs.readJson(motoristasFile);
    res.json(motoristas);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao listar motoristas." });
  }
});

app.post("/api/motoristas", async (req, res) => {
  try {
    const { nome, matricula, setor } = req.body;

    if (!nome || !matricula || !setor) {
      return res.status(400).json({ erro: "Nome, matrícula e setor são obrigatórios." });
    }

    const motoristas = await fs.readJson(motoristasFile);

    const matriculaJaExiste = motoristas.some(
      m => String(m.matricula).trim().toLowerCase() === String(matricula).trim().toLowerCase()
    );

    if (matriculaJaExiste) {
      return res.status(400).json({ erro: "Já existe um motorista cadastrado com essa matrícula." });
    }

    const novoMotorista = {
      id: Date.now(),
      nome: String(nome).trim(),
      matricula: String(matricula).trim(),
      setor: String(setor).trim()
    };

    motoristas.push(novoMotorista);
    await fs.writeJson(motoristasFile, motoristas, { spaces: 2 });

    res.json({ ok: true, motorista: novoMotorista });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao cadastrar motorista." });
  }
});

app.put("/api/motoristas/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome, matricula, setor } = req.body;

    let motoristas = await fs.readJson(motoristasFile);
    const index = motoristas.findIndex(m => m.id === id);

    if (index === -1) {
      return res.status(404).json({ erro: "Motorista não encontrado." });
    }

    const matriculaJaExiste = motoristas.some(
      m =>
        m.id !== id &&
        String(m.matricula).trim().toLowerCase() === String(matricula).trim().toLowerCase()
    );

    if (matriculaJaExiste) {
      return res.status(400).json({ erro: "Já existe outro motorista cadastrado com essa matrícula." });
    }

    motoristas[index] = {
      ...motoristas[index],
      nome: String(nome).trim(),
      matricula: String(matricula).trim(),
      setor: String(setor).trim()
    };

    await fs.writeJson(motoristasFile, motoristas, { spaces: 2 });
    res.json({ ok: true, motorista: motoristas[index] });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao editar motorista." });
  }
});

app.delete("/api/motoristas/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    let motoristas = await fs.readJson(motoristasFile);
    const movimentacoes = await fs.readJson(movimentacoesFile);

    const motorista = motoristas.find(m => m.id === id);

    if (!motorista) {
      return res.status(404).json({ erro: "Motorista não encontrado." });
    }

    const temMovimentacao = movimentacoes.some(m => m.motoristaId === id);

    if (temMovimentacao) {
      return res.status(400).json({
        erro: "Este motorista já possui movimentações registradas e não pode ser excluído."
      });
    }

    motoristas = motoristas.filter(m => m.id !== id);
    await fs.writeJson(motoristasFile, motoristas, { spaces: 2 });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao excluir motorista." });
  }
});

/* =========================
   MOVIMENTAÇÕES
========================= */

app.get("/api/movimentacoes", async (req, res) => {
  try {
    const movimentacoes = await fs.readJson(movimentacoesFile);
    res.json(movimentacoes);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao listar movimentações." });
  }
});

app.post("/api/retirada", async (req, res) => {
  try {
    const {
      veiculoId,
      motoristaId,
      dataSaida,
      observacaoSaida,
      assinaturaSaida
    } = req.body;

    if (!veiculoId || !motoristaId) {
      return res.status(400).json({ erro: "Veículo e motorista são obrigatórios." });
    }

    let veiculos = await fs.readJson(veiculosFile);
    let movimentacoes = await fs.readJson(movimentacoesFile);
    const motoristas = await fs.readJson(motoristasFile);

    const veiculoIdNum = Number(veiculoId);
    const motoristaIdNum = Number(motoristaId);

    const veiculo = veiculos.find(v => v.id === veiculoIdNum);
    const motorista = motoristas.find(m => m.id === motoristaIdNum);

    if (!veiculo) {
      return res.status(404).json({ erro: "Veículo não encontrado." });
    }

    if (!motorista) {
      return res.status(404).json({ erro: "Motorista não encontrado." });
    }

    if (veiculo.status === "em uso") {
      return res.status(400).json({ erro: "Este veículo já está em uso." });
    }

    const novaMovimentacao = {
      id: Date.now(),
      veiculoId: veiculoIdNum,
      motoristaId: motoristaIdNum,
      dataSaida: dataSaida || new Date().toLocaleString("pt-BR"),
      observacaoSaida: observacaoSaida || "",
      assinaturaSaida: assinaturaSaida || "",
      dataChegada: "",
      observacaoChegada: "",
      assinaturaChegada: "",
      status: "em uso"
    };

    movimentacoes.push(novaMovimentacao);

    veiculos = veiculos.map(v =>
      v.id === veiculoIdNum ? { ...v, status: "em uso" } : v
    );

    await fs.writeJson(movimentacoesFile, movimentacoes, { spaces: 2 });
    await fs.writeJson(veiculosFile, veiculos, { spaces: 2 });

    res.json({ ok: true, movimentacao: novaMovimentacao });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao registrar retirada." });
  }
});

app.post("/api/devolucao", async (req, res) => {
  try {
    const {
      id,
      veiculoId,
      dataChegada,
      observacaoChegada,
      assinaturaChegada
    } = req.body;

    if (!id || !veiculoId) {
      return res.status(400).json({ erro: "Movimentação e veículo são obrigatórios." });
    }

    let movimentacoes = await fs.readJson(movimentacoesFile);
    let veiculos = await fs.readJson(veiculosFile);

    const idNum = Number(id);
    const veiculoIdNum = Number(veiculoId);

    const movimentacao = movimentacoes.find(m => m.id === idNum);
    if (!movimentacao) {
      return res.status(404).json({ erro: "Movimentação não encontrada." });
    }

    movimentacoes = movimentacoes.map(m => {
      if (m.id === idNum) {
        return {
          ...m,
          dataChegada: dataChegada || new Date().toLocaleString("pt-BR"),
          observacaoChegada: observacaoChegada || "",
          assinaturaChegada: assinaturaChegada || "",
          status: "finalizado"
        };
      }
      return m;
    });

    veiculos = veiculos.map(v =>
      v.id === veiculoIdNum ? { ...v, status: "disponivel" } : v
    );

    await fs.writeJson(movimentacoesFile, movimentacoes, { spaces: 2 });
    await fs.writeJson(veiculosFile, veiculos, { spaces: 2 });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao registrar devolução." });
  }
});

/* =========================
   PDF
========================= */

function desenharCabecalho(doc, movId) {
  if (fs.existsSync(logoFile)) {
    doc.image(logoFile, 40, 32, {
      fit: [90, 55],
      align: "left",
      valign: "center"
    });
  }

  doc
    .rect(140, 35, 415, 55)
    .fill("#0f172a");

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("COMPROVANTE DE MOVIMENTAÇÃO DE VEÍCULO", 155, 48, {
      align: "center",
      width: 385
    });

  doc
    .font("Helvetica")
    .fontSize(10)
    .text(`Nº Registro: ${movId}`, 430, 72);

  doc
    .fillColor("#0f172a")
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("DARA PRODUÇÕES E EVENTOS", 40, 95, {
      align: "center",
      width: 515
    });

  doc.fillColor("#000000");
}

function desenharSecao(doc, titulo, y) {
  doc
    .roundedRect(40, y, 515, 24, 6)
    .fill("#e2e8f0");

  doc
    .fillColor("#0f172a")
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(titulo, 52, y + 7);

  doc.fillColor("#000000");
}

function desenharLinhaCampo(doc, label, valor, x, y, largura = 230) {
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(`${label}:`, x, y, { continued: true });

  doc
    .font("Helvetica")
    .text(` ${valor || "-"}`, { width: largura });
}

function desenharAssinaturaBox(doc, titulo, base64, x, y) {
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(titulo, x, y);

  doc
    .roundedRect(x, y + 18, 230, 110, 8)
    .stroke("#94a3b8");

  if (base64 && base64.startsWith("data:image")) {
    try {
      const cleanBase64 = base64.replace(/^data:image\/png;base64,/, "");
      const imgBuffer = Buffer.from(cleanBase64, "base64");
      doc.image(imgBuffer, x + 10, y + 28, {
        fit: [210, 70],
        align: "center",
        valign: "center"
      });
    } catch (error) {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#64748b")
        .text("Erro ao carregar assinatura", x + 20, y + 62, {
          width: 190,
          align: "center"
        })
        .fillColor("#000000");
    }
  } else {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#64748b")
      .text("Assinatura não informada", x + 20, y + 62, {
        width: 190,
        align: "center"
      })
      .fillColor("#000000");
  }

  doc
    .moveTo(x + 20, y + 98)
    .lineTo(x + 210, y + 98)
    .stroke("#cbd5e1");

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#475569")
    .text("Assinatura", x, y + 102, {
      width: 230,
      align: "center"
    })
    .fillColor("#000000");
}

app.get("/api/comprovante/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const movimentacoes = await fs.readJson(movimentacoesFile);
    const veiculos = await fs.readJson(veiculosFile);
    const motoristas = await fs.readJson(motoristasFile);

    const mov = movimentacoes.find(m => m.id === id);

    if (!mov) {
      return res.status(404).send("Movimentação não encontrada.");
    }

    const veiculo = veiculos.find(v => v.id === mov.veiculoId);
    const motorista = motoristas.find(m => m.id === mov.motoristaId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=comprovante-${id}.pdf`);

    const doc = new PDFDocument({
      size: "A4",
      margin: 40
    });

    doc.pipe(res);

    desenharCabecalho(doc, id);

    let y = 122;

    desenharSecao(doc, "DADOS DO VEÍCULO", y);
    y += 38;

    desenharLinhaCampo(doc, "Veículo", veiculo?.nome || "-", 50, y, 220);
    desenharLinhaCampo(doc, "Placa", veiculo?.placa || "-", 320, y, 180);
    y += 22;
    desenharLinhaCampo(doc, "Tipo", veiculo?.tipo || "-", 50, y, 220);

    y += 40;
    desenharSecao(doc, "DADOS DO MOTORISTA", y);
    y += 38;

    desenharLinhaCampo(doc, "Nome", motorista?.nome || "-", 50, y, 220);
    desenharLinhaCampo(doc, "Matrícula", motorista?.matricula || "-", 320, y, 180);
    y += 22;
    desenharLinhaCampo(doc, "Setor", motorista?.setor || "-", 50, y, 220);

    y += 40;
    desenharSecao(doc, "DADOS DA MOVIMENTAÇÃO", y);
    y += 38;

    desenharLinhaCampo(doc, "Saída", mov.dataSaida || "-", 50, y, 220);
    desenharLinhaCampo(doc, "Devolução", mov.dataChegada || "-", 320, y, 180);
    y += 22;
    desenharLinhaCampo(doc, "Status", mov.status || "-", 50, y, 220);

    y += 30;
    doc.font("Helvetica-Bold").fontSize(10).text("Observação de saída:", 50, y);
    y += 14;
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(mov.observacaoSaida || "-", 50, y, {
        width: 480,
        align: "left"
      });

    y += 42;
    doc.font("Helvetica-Bold").fontSize(10).text("Observação de devolução:", 50, y);
    y += 14;
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(mov.observacaoChegada || "-", 50, y, {
        width: 480,
        align: "left"
      });

    y += 55;
    desenharSecao(doc, "ASSINATURAS", y);
    y += 38;

    desenharAssinaturaBox(doc, "Saída", mov.assinaturaSaida, 50, y);
    desenharAssinaturaBox(doc, "Devolução", mov.assinaturaChegada, 315, y);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#64748b")
      .text(
        "Documento gerado automaticamente pelo sistema Controle de Veículos.",
        40,
        780,
        { align: "center", width: 515 }
      );

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send("Erro ao gerar PDF.");
  }
});

init()
  .then(async () => {
    try {
      const destino = await criarBackup();
      console.log(`Backup inicial criado em: ${destino}`);
      await limparBackupsAntigos(30);
    } catch (error) {
      console.error("Erro ao criar backup inicial:", error);
    }

    agendarBackups();

    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
      console.log(`Backups configurados para: ${backupBaseDir}`);
    });
  })
  .catch((error) => {
    console.error("Erro ao iniciar sistema:", error);
  });