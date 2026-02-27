import os
import sqlite3
import time

DB_FILE = "wiki.db"

from flask import Flask, jsonify, send_from_directory, request
import sqlite3
import os
import time

app = Flask(__name__, static_folder="frontend")

DB_FILE = "wiki.db"

def get_conn():
    conn = sqlite3.connect(DB_FILE, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def criar_tabelas(reset=True):
    # Reset “de verdade” no SQLite: apaga o arquivo do banco (e WAL/SHM)
    if reset:
        for path in (DB_FILE, DB_FILE + "-wal", DB_FILE + "-shm"):
            if os.path.exists(path):
                try:
                    os.remove(path)
                except PermissionError:
                    # tenta novamente algumas vezes
                    for _ in range(10):
                        time.sleep(0.2)
                        try:
                            os.remove(path)
                            break
                        except PermissionError:
                            pass

    conn = get_conn()
    cur = conn.cursor()

    cur.executescript("""
    -- =========================
    -- BASE: PAGES (entidade raiz)
    -- =========================
    CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        entidade TEXT NOT NULL CHECK (entidade IN ('personagem','local','organizacao','criatura','evento','item')),
        autor TEXT,
        data_criacao TEXT DEFAULT (datetime('now')),
        data_atualizacao TEXT DEFAULT (datetime('now')),
        imagem TEXT,
        notas TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pages_entidade ON pages(entidade);
    CREATE INDEX IF NOT EXISTS idx_pages_titulo ON pages(titulo);

    -- ==================================
    -- TABELAS ESPECÍFICAS (1:1 com pages)
    -- ==================================
    CREATE TABLE IF NOT EXISTS personagens (
        page_id INTEGER PRIMARY KEY,
        tipo TEXT, -- subtipo (classe/arquétipo)
        idade INTEGER,
        genero TEXT,
        status_vida TEXT DEFAULT 'vivo' CHECK (status_vida IN ('vivo','morto','desconhecido')),
        aparencia TEXT,
        descricao TEXT,
        aniversario TEXT,
        FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS locais (
        page_id INTEGER PRIMARY KEY,
        tipo TEXT, -- subtipo (cidade, dungeon, planeta...)
        descricao TEXT,
        status_local TEXT DEFAULT 'ativo' CHECK (status_local IN ('ativo','destruido','abandonado','desconhecido')),
        FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS organizacoes (
        page_id INTEGER PRIMARY KEY,
        tipo TEXT, -- subtipo (guilda, seita, empresa...)
        descricao TEXT,
        status_org TEXT DEFAULT 'ativa' CHECK (status_org IN ('ativa','extinta','desconhecida')),
        FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS criaturas (
        page_id INTEGER PRIMARY KEY,
        tipo TEXT, -- subtipo (dragão, espírito...)
        elemento TEXT,
        descricao TEXT,
        status TEXT DEFAULT 'viva' CHECK (status IN ('viva','morta','extinta','desconhecida')),
        FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS eventos (
        page_id INTEGER PRIMARY KEY,
        tipo TEXT, -- subtipo (batalha, ritual...)
        descricao TEXT,
        data_inicio TEXT,
        data_fim TEXT,
        FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS itens (
        page_id INTEGER PRIMARY KEY,
        tipo TEXT, -- subtipo (artefato, arma...)
        descricao TEXT,
        FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    -- ==========
    -- TAGS (N:N)
    -- ==========
    CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS page_tags (
        page_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (page_id, tag_id),
        FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_page_tags_page ON page_tags(page_id);
    CREATE INDEX IF NOT EXISTS idx_page_tags_tag ON page_tags(tag_id);

    -- =====================
    -- RELAÇÕES (grafo geral)
    -- =====================
    CREATE TABLE IF NOT EXISTS relacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        origem_page_id INTEGER NOT NULL,
        destino_page_id INTEGER NOT NULL,
        tipo_relacao TEXT NOT NULL,
        rotulo TEXT,
        notas TEXT,
        data_inicio TEXT,
        data_fim TEXT,
        FOREIGN KEY (origem_page_id) REFERENCES pages(id) ON DELETE CASCADE,
        FOREIGN KEY (destino_page_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_rel_origem_tipo ON relacoes(origem_page_id, tipo_relacao);
    CREATE INDEX IF NOT EXISTS idx_rel_destino_tipo ON relacoes(destino_page_id, tipo_relacao);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_relacao_tripla
    ON relacoes(origem_page_id, destino_page_id, tipo_relacao);
    """)

    conn.commit()
    conn.close()
    
def run_migrations():
    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS migrations (
            name TEXT PRIMARY KEY,
            applied_at TEXT DEFAULT (datetime('now'))
        )
    """)

    conn.commit()
    conn.close()

import json

def _to_text_or_none(v):
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    s = str(v).strip()
    return s if s != "" else None

def _to_int_or_none(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        return int(v)

    s = str(v).strip()
    if s == "" or s.lower() == "null":
        return None
    try:
        # aceita "12", "12.0"
        return int(float(s))
    except (ValueError, TypeError):
        return None

def _normalize_status(val, allowed: set, default: str):
    if val is None:
        return default
    s = str(val).strip().lower()
    return s if s in allowed else default


def _get_id_from_request(data):
    raw = None
    # aceita querystring ?id=
    if request.args.get("id"):
        raw = request.args.get("id")
    elif isinstance(data, dict) and data.get("id") is not None:
        raw = data.get("id")

    if raw is None:
        return None

    try:
        return int(raw)
    except (TypeError, ValueError):
        return None
def _merge_payload(data: dict) -> dict:
    """
    Suporta:
      - payload antigo: {titulo, entidade, idade, ... , tags:[]}
      - payload novo: {base:{...}, especifico:{...}, tags:[]}
    """
    base = data.get("base") if isinstance(data.get("base"), dict) else {}
    esp  = data.get("especifico") if isinstance(data.get("especifico"), dict) else {}
    merged = {**data, **base, **esp}  # root ganha prioridade do base/esp? aqui base/esp sobrescreve root
    # mantém tags do topo (mais comum)
    if "tags" in data:
        merged["tags"] = data["tags"]
    return merged

@app.route("/api/paginass", methods=["POST"])
def api_criar_pagina():
    data = request.get_json(silent=True) or {}

    titulo = (data.get("titulo") or "").strip()
    entidade = (data.get("entidade") or "").strip().lower()

    if not titulo:
        return jsonify({"erro": "Campo obrigatório: titulo"}), 400

    entidades_validas = {"personagem", "local", "organizacao", "criatura", "evento", "item"}
    if entidade not in entidades_validas:
        return jsonify({"erro": f"Entidade inválida. Use: {sorted(entidades_validas)}"}), 400

    autor = _to_text_or_none(data.get("autor"))
    imagem = _to_text_or_none(data.get("imagem"))
    notas = data.get("notas")
    if notas is not None:
        notas = str(notas)

    conn = get_conn()
    cur = conn.cursor()

    try:
        # 1) base
        cur.execute(
            """
            INSERT INTO pages (titulo, entidade, autor, imagem, notas)
            VALUES (?, ?, ?, ?, ?)
            """,
            (titulo, entidade, autor, imagem, notas),
        )
        page_id = cur.lastrowid

        # 2) específico (usa `tipo` como subtipo)
        subtipo = _to_text_or_none(data.get("tipo"))

        if entidade == "personagem":
            cur.execute(
                """
                INSERT INTO personagens (page_id, tipo, idade, genero, status_vida, aparencia, descricao, aniversario)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    page_id,
                    subtipo,
                    _to_int_or_none(data.get("idade")),
                    _to_text_or_none(data.get("genero")),
                    _normalize_status(data.get("status_vida"), {"vivo","morto","desconhecido"}, default="vivo"),
                    _to_text_or_none(data.get("aparencia")),
                    _to_text_or_none(data.get("descricao")),
                    _to_text_or_none(data.get("aniversario")),
                ),
            )

        elif entidade == "local":
            cur.execute(
                """
                INSERT INTO locais (page_id, tipo, descricao, status_local)
                VALUES (?, ?, ?, ?)
                """,
                (
                    page_id,
                    subtipo,
                    _to_text_or_none(data.get("descricao")),
                    _normalize_status(data.get("status_local"), {"ativo","destruido","abandonado","desconhecido"}, default="ativo"),
                ),
            )

        elif entidade == "organizacao":
            cur.execute(
                """
                INSERT INTO organizacoes (page_id, tipo, descricao, status_org)
                VALUES (?, ?, ?, ?)
                """,
                (
                    page_id,
                    subtipo,
                    _to_text_or_none(data.get("descricao")),
                    _normalize_status(data.get("status_org"), {"ativa","extinta","desconhecida"}, default="ativa"),
                ),
            )

        elif entidade == "criatura":
            cur.execute(
                """
                INSERT INTO criaturas (page_id, tipo, elemento, descricao, status)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    page_id,
                    subtipo,
                    _to_text_or_none(data.get("elemento")),
                    _to_text_or_none(data.get("descricao")),
                    _normalize_status(data.get("status"), {"viva","morta","extinta","desconhecida"}, default="viva"),
                ),
            )

        elif entidade == "evento":
            cur.execute(
                """
                INSERT INTO eventos (page_id, tipo, descricao, data_inicio, data_fim)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    page_id,
                    subtipo,
                    _to_text_or_none(data.get("descricao")),
                    _to_text_or_none(data.get("data_inicio") or data.get("data")),
                    _to_text_or_none(data.get("data_fim")),
                ),
            )

        elif entidade == "item":
            cur.execute(
                """
                INSERT INTO itens (page_id, tipo, descricao)
                VALUES (?, ?, ?)
                """,
                (
                    page_id,
                    subtipo,
                    _to_text_or_none(data.get("descricao")),
                ),
            )

        # 3) tags (opcional): ["a","b"] no mesmo nível
        tags = data.get("tags")
        if isinstance(tags, list):
            for t in [str(x).strip() for x in tags]:
                if not t:
                    continue
                cur.execute("INSERT OR IGNORE INTO tags (nome) VALUES (?)", (t,))
                cur.execute("SELECT id FROM tags WHERE nome = ?", (t,))
                row = cur.fetchone()
                if row:
                    tag_id = row[0]
                    cur.execute(
                        "INSERT OR IGNORE INTO page_tags (page_id, tag_id) VALUES (?, ?)",
                        (page_id, tag_id),
                    )

        conn.commit()
        return jsonify({"ok": True, "id": page_id}), 201

    except sqlite3.IntegrityError as e:
        conn.rollback()
        return jsonify({"erro": "Falha de integridade no banco", "detalhe": str(e)}), 400
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": "Erro interno", "detalhe": str(e)}), 500
    finally:
        conn.close()
# ----------------------
# Rotas básicas
# ----------------------
@app.route("/api/paginas", methods=["GET"])
def api_listar_paginas():
    entidade = (request.args.get("entidade") or "").strip().lower()
    q = (request.args.get("q") or "").strip()

    conn = get_conn()
    cur = conn.cursor()

    sql = "SELECT id, titulo, entidade, imagem, autor, data_criacao, data_atualizacao FROM pages"
    params = []
    where = []

    if entidade:
        where.append("entidade = ?")
        params.append(entidade)

    if q:
        where.append("titulo LIKE ?")
        params.append(f"%{q}%")

    if where:
        sql += " WHERE " + " AND ".join(where)

    sql += " ORDER BY data_atualizacao DESC, id DESC LIMIT 200"

    cur.execute(sql, params)
    rows = cur.fetchall()
    conn.close()

    paginas = []
    for r in rows:
        paginas.append({
            "id": r["id"],
            "titulo": r["titulo"],
            "entidade": r["entidade"],
            "tipo": r["entidade"],
            "imagem": r["imagem"],
            "autor": r["autor"],
            "data_criacao": r["data_criacao"],
            "data_atualizacao": r["data_atualizacao"],
        })

    return jsonify(paginas)

@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")



# ----------------------
# Tags
# ----------------------
@app.route("/api/paginas_tags", methods=["GET"])
def api_listar_pagina_tags():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT pt.page_id, t.nome
        FROM page_tags pt
        JOIN tags t ON t.id = pt.tag_id
        ORDER BY pt.page_id
    """)
    rows = cur.fetchall()
    conn.close()

    # Formato comum: { page_id: ["tag1","tag2"] }
    out = {}
    for r in rows:
        pid = r["page_id"]
        out.setdefault(pid, []).append(r["nome"])

    return jsonify(out)

# ----------------------
# Detalhes de uma página
# ----------------------
@app.route("/api/pagina/<int:pagina_id>", methods=["GET"])
def api_get_pagina(pagina_id):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT * FROM pages WHERE id = ?", (pagina_id,))
    base = cur.fetchone()
    if not base:
        conn.close()
        return jsonify({"erro": "Página não encontrada"}), 404

    entidade = base["entidade"]

    especifico = None
    if entidade == "personagem":
        cur.execute("SELECT * FROM personagens WHERE page_id = ?", (pagina_id,))
        especifico = cur.fetchone()
    elif entidade == "local":
        cur.execute("SELECT * FROM locais WHERE page_id = ?", (pagina_id,))
        especifico = cur.fetchone()
    elif entidade == "organizacao":
        cur.execute("SELECT * FROM organizacoes WHERE page_id = ?", (pagina_id,))
        especifico = cur.fetchone()
    elif entidade == "criatura":
        cur.execute("SELECT * FROM criaturas WHERE page_id = ?", (pagina_id,))
        especifico = cur.fetchone()
    elif entidade == "evento":
        cur.execute("SELECT * FROM eventos WHERE page_id = ?", (pagina_id,))
        especifico = cur.fetchone()
    elif entidade == "item":
        cur.execute("SELECT * FROM itens WHERE page_id = ?", (pagina_id,))
        especifico = cur.fetchone()

    # tags
    cur.execute("""
        SELECT t.nome
        FROM page_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE pt.page_id = ?
        ORDER BY t.nome
    """, (pagina_id,))
    tags = [r["nome"] for r in cur.fetchall()]

    # relações (saindo e entrando)
    cur.execute("""
        SELECT r.*, p2.titulo as destino_titulo, p2.entidade as destino_entidade
        FROM relacoes r
        JOIN pages p2 ON p2.id = r.destino_page_id
        WHERE r.origem_page_id = ?
        ORDER BY r.tipo_relacao, r.id
    """, (pagina_id,))
    rel_out = [dict(row) for row in cur.fetchall()]

    cur.execute("""
        SELECT r.*, p1.titulo as origem_titulo, p1.entidade as origem_entidade
        FROM relacoes r
        JOIN pages p1 ON p1.id = r.origem_page_id
        WHERE r.destino_page_id = ?
        ORDER BY r.tipo_relacao, r.id
    """, (pagina_id,))
    rel_in = [dict(row) for row in cur.fetchall()]

    conn.close()

    out = dict(base)
    esp = dict(especifico) if especifico else {}
    out["especifico"] = esp

# FLATTEN: joga os campos específicos no topo (o front costuma esperar assim)
# (não sobrescreve o id da página, só o resto)
    for k, v in esp.items():
        if k == "page_id":
            continue
        out[k] = v

# compat: classe vem do específico.tipo
    if out["entidade"] == "personagem":
        out["classe"] = esp.get("tipo")

# sempre devolve tags/relacoes
    out["tags"] = tags
    out["relacoes"] = {"saindo": rel_out, "entrando": rel_in}

    return jsonify(out)


# ----------------------
# Criar página
# ----------------------
@app.route("/api/paginas", methods=["POST"])
@app.route("/api/pages", methods=["POST"])              # opcional (alias)
@app.route("/api/criar_pagina", methods=["POST"])       # alias p/ front antigo
@app.route("/api/criar_paginas", methods=["POST"])      # alias p/ front antigo
def api_criar_pagina_universal():
    data = request.get_json(silent=True) or {}
    data = _merge_payload(data)

    # Compatibilidade: alguns fronts mandam "tipo" como entidade
    entidade = (data.get("entidade") or data.get("tipo") or "").strip().lower()
    if not entidade:
        entidade = (data.get("tipo") or "").strip().lower()

    titulo = (data.get("titulo") or "").strip()

    if not titulo:
        return jsonify({"erro": "Campo obrigatório: titulo"}), 400

    entidades_validas = {"personagem", "local", "organizacao", "criatura", "evento", "item"}
    if entidade not in entidades_validas:
        return jsonify({"erro": f"Entidade inválida. Use: {sorted(entidades_validas)}"}), 400

    autor = _to_text_or_none(data.get("autor"))
    imagem = _to_text_or_none(data.get("imagem"))
    notas = data.get("notas")
    if notas is not None:
        notas = str(notas)

    # subtipo: aceita "tipo" (novo) ou "subtipo"/"tipo_especifico" (se o front tiver)
    subtipo = _to_text_or_none(data.get("classe")) or _to_text_or_none(data.get("subtipo")) or _to_text_or_none(data.get("tipo_especifico"))
    # se vier um payload novo no futuro com "entidade" + "tipo" (subtipo), aceita também:
    if data.get("entidade"):
        subtipo = subtipo or _to_text_or_none(data.get("tipo"))

    conn = get_conn()
    cur = conn.cursor()

    try:
        # BASE (tabela é pages, NÃO paginas)
        cur.execute(
            "INSERT INTO pages (titulo, entidade, autor, imagem, notas) VALUES (?, ?, ?, ?, ?)",
            (titulo, entidade, autor, imagem, notas),
        )
        page_id = cur.lastrowid

        # ESPECÍFICO
        if entidade == "personagem":
            cur.execute("""
                INSERT INTO personagens (page_id, tipo, idade, genero, status_vida, aparencia, descricao, aniversario)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                page_id, subtipo,
                _to_int_or_none(data.get("idade")),
                _to_text_or_none(data.get("genero")),
                _normalize_status(data.get("status_vida"), {"vivo","morto","desconhecido"}, "vivo"),
                _to_text_or_none(data.get("aparencia")),
                _to_text_or_none(data.get("descricao")),
                _to_text_or_none(data.get("aniversario")),
            ))

        elif entidade == "local":
            cur.execute("""
                INSERT INTO locais (page_id, tipo, descricao, status_local)
                VALUES (?, ?, ?, ?)
            """, (
                page_id, subtipo,
                _to_text_or_none(data.get("descricao")),
                _normalize_status(data.get("status_local"), {"ativo","destruido","abandonado","desconhecido"}, "ativo"),
            ))

        elif entidade == "organizacao":
            cur.execute("""
                INSERT INTO organizacoes (page_id, tipo, descricao, status_org)
                VALUES (?, ?, ?, ?)
            """, (
                page_id, subtipo,
                _to_text_or_none(data.get("descricao")),
                _normalize_status(data.get("status_org"), {"ativa","extinta","desconhecida"}, "ativa"),
            ))

        elif entidade == "criatura":
            cur.execute("""
                INSERT INTO criaturas (page_id, tipo, elemento, descricao, status)
                VALUES (?, ?, ?, ?, ?)
            """, (
                page_id, subtipo,
                _to_text_or_none(data.get("elemento")),
                _to_text_or_none(data.get("descricao")),
                _normalize_status(data.get("status"), {"viva","morta","extinta","desconhecida"}, "viva"),
            ))

        elif entidade == "evento":
            cur.execute("""
                INSERT INTO eventos (page_id, tipo, descricao, data_inicio, data_fim)
                VALUES (?, ?, ?, ?, ?)
            """, (
                page_id, subtipo,
                _to_text_or_none(data.get("descricao")),
                _to_text_or_none(data.get("data_inicio") or data.get("data")),
                _to_text_or_none(data.get("data_fim")),
            ))

        elif entidade == "item":
            cur.execute("""
                INSERT INTO itens (page_id, tipo, descricao)
                VALUES (?, ?, ?)
            """, (
                page_id, subtipo,
                _to_text_or_none(data.get("descricao")),
            ))

        # TAGS
        tags = data.get("tags")
        if isinstance(tags, list):
            for t in [str(x).strip() for x in tags]:
                if not t:
                    continue
                cur.execute("INSERT OR IGNORE INTO tags (nome) VALUES (?)", (t,))
                cur.execute("SELECT id FROM tags WHERE nome = ?", (t,))
                tag_row = cur.fetchone()
                if tag_row:
                    cur.execute(
                        "INSERT OR IGNORE INTO page_tags (page_id, tag_id) VALUES (?, ?)",
                        (page_id, tag_row[0]),
                    )

        conn.commit()
        return jsonify({"ok": True, "id": page_id}), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"erro": "Erro ao criar", "detalhe": str(e)}), 500
    finally:
        conn.close()
# ----------------------
# Editar página
# ----------------------
@app.route("/api/editar_pagina", methods=["POST"])
@app.route("/api/editar_paginas", methods=["POST"])
def api_editar_pagina():
    print(">>> ENTROU NO api_editar_pagina")

    data = request.get_json(silent=True) or {}
    data = _merge_payload(data)

    pagina_id = _get_id_from_request(data)
    if not pagina_id:
        return jsonify({"erro": "Campo obrigatório: id (via ?id= ou JSON)"}), 400

    try:
        pid = int(pagina_id)
    except (TypeError, ValueError):
        return jsonify({"erro": "id inválido", "detalhe": f"recebido: {pagina_id!r}"}), 400

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT entidade FROM pages WHERE id = ?", (pid,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"erro": "Página não encontrada"}), 404

    entidade = row["entidade"]

    titulo = (data.get("titulo") or "").strip()
    autor = _to_text_or_none(data.get("autor"))
    imagem = _to_text_or_none(data.get("imagem"))
    notas = data.get("notas")
    if notas is not None:
        notas = str(notas)

    if not titulo:
        conn.close()
        return jsonify({"erro": "Campo obrigatório: titulo"}), 400

    # subtipo: aceita "classe" ou "tipo"
    subtipo = _to_text_or_none(data.get("classe")) or _to_text_or_none(data.get("tipo"))

    try:
        # BASE
        cur.execute("""
            UPDATE pages
            SET titulo = ?, autor = ?, imagem = ?, notas = ?, data_atualizacao = datetime('now')
            WHERE id = ?
        """, (titulo, autor, imagem, notas, pid))

        # ESPECÍFICOS (todos com page_id)
        if entidade == "personagem":
            cur.execute("""
                INSERT INTO personagens (
                    page_id, tipo, idade, genero, status_vida, aparencia, descricao, aniversario
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(page_id) DO UPDATE SET
                    tipo=excluded.tipo,
                    idade=excluded.idade,
                    genero=excluded.genero,
                    status_vida=excluded.status_vida,
                    aparencia=excluded.aparencia,
                    descricao=excluded.descricao,
                    aniversario=excluded.aniversario
            """, (
                pid,
                subtipo,  # vem de classe ou tipo
                _to_int_or_none(data.get("idade")),
                _to_text_or_none(data.get("genero")),
                _normalize_status(data.get("status_vida"), {"vivo","morto","desconhecido"}, "vivo"),
                _to_text_or_none(data.get("aparencia")),
                _to_text_or_none(data.get("descricao")),
                _to_text_or_none(data.get("aniversario")),
            ))

        elif entidade == "local":
            cur.execute("""
                INSERT INTO locais (page_id, tipo, descricao, status_local)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(page_id) DO UPDATE SET
                    tipo=excluded.tipo,
                    descricao=excluded.descricao,
                    status_local=excluded.status_local
            """, (
                pid,
                subtipo,
                _to_text_or_none(data.get("descricao")),
                _normalize_status(data.get("status_local"), {"ativo","destruido","abandonado","desconhecido"}, "ativo"),
            ))

        elif entidade == "organizacao":
            cur.execute("""
                INSERT INTO organizacoes (page_id, tipo, descricao, status_org)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(page_id) DO UPDATE SET
                    tipo=excluded.tipo,
                    descricao=excluded.descricao,
                    status_org=excluded.status_org
            """, (
                pid,
                subtipo,
                _to_text_or_none(data.get("descricao")),
                _normalize_status(data.get("status_org"), {"ativa","extinta","desconhecida"}, "ativa"),
            ))

        elif entidade == "criatura":
            cur.execute("""
                INSERT INTO criaturas (page_id, tipo, elemento, descricao, status)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(page_id) DO UPDATE SET
                    tipo=excluded.tipo,
                    elemento=excluded.elemento,
                    descricao=excluded.descricao,
                    status=excluded.status
            """, (
                pid,
                subtipo,
                _to_text_or_none(data.get("elemento")),
                _to_text_or_none(data.get("descricao")),
                _normalize_status(data.get("status"), {"viva","morta","extinta","desconhecido"}, "viva"),
            ))

        elif entidade == "evento":
            cur.execute("""
                INSERT INTO eventos (page_id, tipo, descricao, data_inicio, data_fim)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(page_id) DO UPDATE SET
                    tipo=excluded.tipo,
                    descricao=excluded.descricao,
                    data_inicio=excluded.data_inicio,
                    data_fim=excluded.data_fim
            """, (
                pid,
                subtipo,
                _to_text_or_none(data.get("descricao")),
                _to_text_or_none(data.get("data_inicio") or data.get("data")),
                _to_text_or_none(data.get("data_fim")),
            ))

        elif entidade == "item":
            cur.execute("""
                INSERT INTO itens (page_id, tipo, descricao)
                VALUES (?, ?, ?)
                ON CONFLICT(page_id) DO UPDATE SET
                    tipo=excluded.tipo,
                    descricao=excluded.descricao
            """, (
                pid,
                subtipo,
                _to_text_or_none(data.get("descricao")),
            ))

        # TAGS (refaz vínculos)
        tags = data.get("tags")
        if isinstance(tags, list):
            cur.execute("DELETE FROM page_tags WHERE page_id = ?", (pid,))
            for t in [str(x).strip() for x in tags]:
                if not t:
                    continue
                cur.execute("INSERT OR IGNORE INTO tags (nome) VALUES (?)", (t,))
                cur.execute("SELECT id FROM tags WHERE nome = ?", (t,))
                tag_row = cur.fetchone()
                if tag_row:
                    cur.execute(
                        "INSERT OR IGNORE INTO page_tags (page_id, tag_id) VALUES (?, ?)",
                        (pid, tag_row[0]),
                    )

        conn.commit()
        return jsonify({"ok": True})

    except Exception as e:
        conn.rollback()
        return jsonify({
            "erro": "Erro ao editar",
            "entidade": entidade,
            "detalhe": str(e),
        }), 500
    finally:
        conn.close()
# ----------------------
# Excluir página
# ----------------------
@app.route("/api/excluir_pagina", methods=["POST"])
@app.route("/api/excluir_paginas", methods=["POST"])
def api_excluir_pagina():
    data = request.get_json(silent=True) or {}
    pagina_id = _get_id_from_request(data)

    if not pagina_id:
        return jsonify({"erro": "Campo obrigatório: id (via ?id= ou JSON)"}), 400

    # ... resto igual ...

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM pages WHERE id = ?", (pagina_id,))
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": "Erro ao excluir", "detalhe": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/organizacoes", methods=["GET"])
def api_listar_organizacoes():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, titulo
        FROM pages
        WHERE entidade = 'organizacao'
        ORDER BY titulo COLLATE NOCASE
        LIMIT 500
    """)
    rows = cur.fetchall()
    conn.close()

    return jsonify([{"id": r["id"], "titulo": r["titulo"]} for r in rows])
@app.route("/api/personagem/<int:personagem_id>/organizacoes", methods=["GET"])
def listar_organizacoes_do_personagem(personagem_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            r.destino_page_id AS organizacao_id,
            p.titulo AS organizacao_titulo,
            r.rotulo AS cargo,
            r.data_inicio AS desde,
            r.data_fim AS ate,
            r.notas
        FROM relacoes r
        JOIN pages p ON p.id = r.destino_page_id
        WHERE r.origem_page_id = ?
          AND r.tipo_relacao = 'membro_de'
        ORDER BY p.titulo ASC
    """, (personagem_id,))
    rows = cur.fetchall()
    conn.close()

    return jsonify([{
        "organizacao_id": r["organizacao_id"],
        "organizacao_titulo": r["organizacao_titulo"],
        "cargo": r["cargo"],
        "desde": r["desde"],
        "ate": r["ate"],
        "status": None,  # legado, não existe mais
        "notas": r["notas"],
    } for r in rows])

@app.route("/api/personagem/<int:personagem_id>/organizacoes", methods=["POST"])
def vincular_org_ao_personagem(personagem_id):
    data = request.get_json(silent=True) or {}
    organizacao_id = _to_int_or_none(data.get("organizacao_id"))
    if not organizacao_id:
        return jsonify({"erro": "organizacao_id é obrigatório"}), 400

    cargo = _to_text_or_none(data.get("cargo"))
    desde = _to_text_or_none(data.get("desde"))
    ate = _to_text_or_none(data.get("ate"))
    notas = _to_text_or_none(data.get("notas"))

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO relacoes
              (origem_page_id, destino_page_id, tipo_relacao, rotulo, notas, data_inicio, data_fim)
            VALUES (?, ?, 'membro_de', ?, ?, ?, ?)
            ON CONFLICT(origem_page_id, destino_page_id, tipo_relacao)
            DO UPDATE SET
              rotulo=excluded.rotulo,
              notas=excluded.notas,
              data_inicio=excluded.data_inicio,
              data_fim=excluded.data_fim
        """, (personagem_id, organizacao_id, cargo, notas, desde, ate))
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": "Erro ao vincular", "detalhe": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/personagem/<int:personagem_id>/organizacoes/<int:organizacao_id>", methods=["DELETE"])
def desvincular_org(personagem_id, organizacao_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        DELETE FROM relacoes
        WHERE origem_page_id = ?
          AND destino_page_id = ?
          AND tipo_relacao = 'membro_de'
    """, (personagem_id, organizacao_id))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.route("/api/organizacao/<int:organizacao_id>/membros", methods=["GET"])
def listar_membros_da_org(organizacao_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            r.origem_page_id AS personagem_id,
            p.titulo AS personagem_titulo,
            r.rotulo AS cargo,
            r.data_inicio AS desde,
            r.data_fim AS ate,
            r.notas
        FROM relacoes r
        JOIN pages p ON p.id = r.origem_page_id
        WHERE r.destino_page_id = ?
          AND r.tipo_relacao = 'membro_de'
        ORDER BY p.titulo ASC
    """, (organizacao_id,))
    rows = cur.fetchall()
    conn.close()

    return jsonify([{
        "personagem_id": r["personagem_id"],
        "personagem_titulo": r["personagem_titulo"],
        "cargo": r["cargo"],
        "desde": r["desde"],
        "ate": r["ate"],
        "status": None,
        "notas": r["notas"],
    } for r in rows])
@app.route("/api/_debug_routes", methods=["GET"])
def _debug_routes():
    return jsonify(sorted([str(r) for r in app.url_map.iter_rules()]))

@app.route("/<path:path>")
def spa_fallback(path):
    # bloqueia QUALQUER chamada de API que por algum motivo caiu aqui
    if path.startswith("api/") or path.startswith("/api/"):
        return jsonify({"erro": "Rota API não encontrada"}), 404

    full_path = os.path.join("frontend", path)
    if os.path.isfile(full_path):
        return send_from_directory("frontend", path)

    return send_from_directory("frontend", "index.html")


criar_tabelas(reset= False)
run_migrations()


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)