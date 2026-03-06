import os
import sqlite3
import time

DB_FILE = "wiki.db"

from flask import Flask, jsonify, send_from_directory, request, session
import sqlite3
import os
import time
import uuid
import functools
from datetime import datetime
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder="frontend")
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "limiar-secret-key-change-me")

UPLOAD_FOLDER = os.path.join(app.root_path, 'frontend', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

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

    -- =========================
    -- AUTH: USUÁRIOS
    -- =========================
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')),
        created_at TEXT DEFAULT (datetime('now')),
        last_login TEXT,
        is_active INTEGER DEFAULT 1
    );

    """)

    conn.commit()
    conn.close()

def ensure_admin_user():
    """Cria o admin padrão se a tabela de usuários estiver vazia."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) as count FROM users")
    if cur.fetchone()["count"] == 0:
        admin_pass = "admin123"
        hash_pw = generate_password_hash(admin_pass)
        cur.execute("""
            INSERT INTO users (username, password_hash, role)
            VALUES (?, ?, ?)
        """, ("admin", hash_pw, "admin"))
        print(f"[*] Usuário admin criado: admin / {admin_pass}")
    conn.commit()
    conn.close()

# --- Decorators de Auth ---

def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, username, role FROM users WHERE id = ? AND is_active = 1", (user_id,))
    user = cur.fetchone()
    conn.close()
    return user

def login_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if not get_current_user():
            return jsonify({"erro": "Login necessário"}), 401
        return f(*args, **kwargs)
    return decorated_function

def roles_required(*roles):
    def decorator(f):
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({"erro": "Login necessário"}), 401
            if user["role"] not in roles:
                return jsonify({"erro": "Sem permissão"}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator
    
def run_migrations():
    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS migrations (
            name TEXT PRIMARY KEY,
            applied_at TEXT DEFAULT (datetime('now'))
        )
    """)

    # Migration: posts table
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_page_id INTEGER NOT NULL,
            tipo TEXT NOT NULL CHECK(tipo IN ('historia','nota')),
            titulo TEXT,
            conteudo_html TEXT NOT NULL DEFAULT '',
            ordem INTEGER NOT NULL DEFAULT 0,
            criado_em TEXT DEFAULT (datetime('now')),
            atualizado_em TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (owner_page_id) REFERENCES pages(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_posts_owner_tipo_ordem
            ON posts(owner_page_id, tipo, ordem);
        CREATE INDEX IF NOT EXISTS idx_posts_owner
            ON posts(owner_page_id);
    """)

    conn.commit()
    # Migration: timeline_events table
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS timeline_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            page_id INTEGER,
            start_text TEXT NOT NULL, -- Format "YYYY-MM-DD HH:MM"
            title TEXT,
            description TEXT,
            group_name TEXT,
            color TEXT,
            FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_timeline_start ON timeline_events(start_text);
        CREATE INDEX IF NOT EXISTS idx_timeline_group ON timeline_events(group_name);
    """)

    # Migration: Campaign Archive
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS campaign_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            file_path TEXT NOT NULL,
            file_name TEXT,
            mime_type TEXT,
            file_kind TEXT,
            file_size INTEGER,
            is_public INTEGER DEFAULT 0,
            author_username TEXT,
            tags_text TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS file_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER NOT NULL,
            page_id INTEGER NOT NULL,
            note TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(file_id, page_id),
            FOREIGN KEY (file_id) REFERENCES campaign_files(id) ON DELETE CASCADE,
            FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_file_links_file ON file_links(file_id);
        CREATE INDEX IF NOT EXISTS idx_file_links_page ON file_links(page_id);
    """)

    # Migration: activity_log table
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT,
            action TEXT,
            entity_id INTEGER,
            entity_title TEXT,
            entity_type TEXT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp);
    """)
    conn.commit()
    conn.close()

def ensure_timeline_sort_order():
    conn = get_conn()
    cur = conn.cursor()

    # vê se a coluna existe
    cur.execute("PRAGMA table_info(timeline_events)")
    cols = [r["name"] for r in cur.fetchall()]

    if "sort_order" not in cols:
        cur.execute("ALTER TABLE timeline_events ADD COLUMN sort_order INTEGER DEFAULT 0")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_timeline_sort_order ON timeline_events(sort_order)")

        # seed inicial: usar a ordem por data como sort_order
        cur.execute("""
          WITH ordered AS (
            SELECT id,
                   ROW_NUMBER() OVER (ORDER BY start_text ASC, id ASC) AS rn
            FROM timeline_events
          )
          UPDATE timeline_events
          SET sort_order = (SELECT rn FROM ordered WHERE ordered.id = timeline_events.id);
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

def log_activity(cur, action, entity_id, entity_title, entity_type, user=None):
    """Insere um registro no log de atividades."""
    if not user:
        user = get_current_user()
    if not user:
        return
    
    cur.execute("""
        INSERT INTO activity_log (user_id, username, action, entity_id, entity_title, entity_type)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user["id"], user["username"], action, entity_id, entity_title, entity_type))

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


# ----------------------
# Rotas básicas
# ----------------------


@app.route("/api/busca_pages")
def busca_pages():
    q = (request.args.get("q") or "").strip()
    entidade = (request.args.get("entidade") or "").strip()

    conn = get_conn()
    cur = conn.cursor()

    sql = "SELECT id, titulo, entidade FROM pages WHERE titulo LIKE ?"
    params = [f"%{q}%"]

    if entidade:
        if entidade not in ("personagem","local","organizacao","criatura","evento","item"):
            return jsonify([])
        sql += " AND entidade = ?"
        params.append(entidade)
        
    sql += " ORDER BY titulo ASC LIMIT 10"

    cur.execute(sql, params)

    rows = cur.fetchall()
    conn.close()

    return jsonify([{"id": r["id"], "titulo": r["titulo"], "entidade": r["entidade"]} for r in rows])



@app.route("/api/upload", methods=["POST"])
@roles_required("admin", "editor")
def api_upload_imagem():
    if 'file' not in request.files:
        return jsonify({"erro": "Nenhum arquivo enviado"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"erro": "Nenhum arquivo selecionado"}), 400

    if file:
        filename = secure_filename(file.filename)
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            return jsonify({"erro": "Formato de arquivo não suportado"}), 400
            
        unique_filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)
        
        return jsonify({"url": f"/uploads/{unique_filename}"}), 200

@app.route("/api/paginas", methods=["GET"])
def api_listar_paginas():
    entidade = (request.args.get("entidade") or "").strip().lower()
    q = (request.args.get("q") or "").strip()

    conn = get_conn()
    cur = conn.cursor()

    sql = """
        SELECT 
            p.id, p.titulo, p.entidade, p.imagem, p.autor, p.data_criacao, p.data_atualizacao,
            COALESCE(pe.descricao, lo.descricao, org.descricao, cr.descricao, ev.descricao, it.descricao) as resumo
        FROM pages p
        LEFT JOIN personagens pe ON pe.page_id = p.id
        LEFT JOIN locais lo ON lo.page_id = p.id
        LEFT JOIN organizacoes org ON org.page_id = p.id
        LEFT JOIN criaturas cr ON cr.page_id = p.id
        LEFT JOIN eventos ev ON ev.page_id = p.id
        LEFT JOIN itens it ON it.page_id = p.id
    """
    params = []
    where = []

    if entidade:
        where.append("p.entidade = ?")
        params.append(entidade)

    if q:
        where.append("p.titulo LIKE ?")
        params.append(f"%{q}%")

    if where:
        sql += " WHERE " + " AND ".join(where)

    sql += " ORDER BY p.data_atualizacao DESC, p.id DESC LIMIT 200"

    cur.execute(sql, params)
    rows = cur.fetchall()
    conn.close()

    paginas = []
    for r in rows:
        paginas.append({
            "id": r["id"],
            "titulo": r["titulo"],
            "entidade": r["entidade"],
            "tipo": r["entidade"],  # backward compatibility
            "imagem": r["imagem"],
            "autor": r["autor"],
            "resumo": r["resumo"],
            "data_criacao": r["data_criacao"],
            "data_atualizacao": r["data_atualizacao"],
        })

    return jsonify(paginas)

@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")

@app.route("/api/timeline", methods=["GET"])
def api_get_timeline():
    start_param = request.args.get("start", "").replace("+", " ").strip()
    end_param = request.args.get("end", "").replace("+", " ").strip()
    group_param = request.args.get("group", "").strip()

    conn = get_conn()
    cur = conn.cursor()

    sql = """
        SELECT t.*, p.entidade as page_entidade, p.imagem as page_image
        FROM timeline_events t
        JOIN pages p ON p.id = t.page_id
        WHERE 1=1
    """
    params = []

    if start_param:
        sql += " AND t.start_text >= ?"
        params.append(start_param)
    
    if end_param:
        sql += " AND t.start_text <= ?"
        params.append(end_param)

    if group_param and group_param.lower() != "todos":
        sql += " AND t.group_name = ?"
        params.append(group_param)

    sql += " ORDER BY t.start_text ASC"

    cur.execute(sql, params)
    rows = cur.fetchall()
    
    # Also fetch unique groups for the filter
    cur.execute("SELECT DISTINCT group_name FROM timeline_events WHERE group_name IS NOT NULL ORDER BY group_name")
    group_rows = cur.fetchall()
    groups = [r["group_name"] for r in group_rows]

    conn.close()

    events = []
    for r in rows:
        events.append({
            "id": r["id"],
            "page_id": r["page_id"],
            "start": r["start_text"],
            "title": r["title"],
            "desc": r["description"],
            "group": r["group_name"],
            "color": r["color"],
            "image": r["page_image"],
            "pageUrl": f"/entity/{r['page_id']}" if r["page_id"] else None
        })

    return jsonify({
        "events": events,
        "groups": groups
    })



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
@roles_required("admin", "editor")
def api_criar_pagina_universal():
    user = get_current_user() 
    data = request.get_json(silent=True) or {}
    data = _merge_payload(data)
    
    # Compatibilidade: alguns fronts mandam "tipo" como entidade
    entidade = (data.get("entidade") or data.get("tipo") or "").strip().lower()
    
    autor = user["username"] # Autor automático do usuário logado

    if not entidade:
        entidade = (data.get("tipo") or "").strip().lower()

    titulo = (data.get("titulo") or "").strip()

    if not titulo:
        return jsonify({"erro": "Campo obrigatório: titulo"}), 400

    entidades_validas = {"personagem", "local", "organizacao", "criatura", "evento", "item"}
    if entidade not in entidades_validas:
        return jsonify({"erro": f"Entidade inválida. Use: {sorted(entidades_validas)}"}), 400

    # autor = _to_text_or_none(data.get("autor"))  <-- Removido: agora é automático
    autor = user["username"]
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

            # ---- TIMELINE AUTO (seguro, não duplica) ----
            # start_text: usa data_inicio se vier no payload; senão usa data_criacao
            start_text = _to_text_or_none(data.get("data_inicio") or data.get("data"))
            if not start_text:
                cur.execute("SELECT substr(data_criacao, 1, 16) AS dt FROM pages WHERE id = ?", (page_id,))
                row = cur.fetchone()
                start_text = (row["dt"] if row else None) or "0001-01-01 00:00"

            cur.execute("""
                INSERT INTO timeline_events (page_id, start_text, title, description, group_name, color)
                SELECT ?, ?, ?, ?, ?, ?
                WHERE NOT EXISTS (
                    SELECT 1 FROM timeline_events WHERE page_id = ?
                )
            """, (
                page_id,
                start_text,
                titulo,
                _to_text_or_none(data.get("descricao")) or notas,
                None,  # group_name (podes ligar depois a tags ou a um campo)
                None,  # color
                page_id
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

        # LOG
        log_activity(cur, 'created', page_id, titulo, entidade, user=user)

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
@roles_required("admin", "editor")
def api_editar_pagina():
    user = get_current_user()
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
    # autor = _to_text_or_none(data.get("autor")) <-- Não permite mudar autor no edit
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
            SET titulo = ?, imagem = ?, notas = ?, data_atualizacao = datetime('now')
            WHERE id = ?
        """, (titulo, imagem, notas, pid))

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

        # LOG
        log_activity(cur, 'updated', pid, titulo, entidade, user=user)

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
@roles_required("admin", "editor")
def api_excluir_pagina():
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    pagina_id = _get_id_from_request(data)

    if not pagina_id:
        return jsonify({"erro": "Campo obrigatório: id (via ?id= ou JSON)"}), 400

    # ... resto igual ...

    conn = get_conn()
    cur = conn.cursor()
    try:
        # Get info for log before deleting
        cur.execute("SELECT titulo, entidade FROM pages WHERE id = ?", (pagina_id,))
        p_info = cur.fetchone()
        
        # Cascade manual for timeline (since FK is SET NULL but we want DELETE)
        cur.execute("DELETE FROM timeline_events WHERE page_id = ?", (pagina_id,))
        
        cur.execute("DELETE FROM pages WHERE id = ?", (pagina_id,))
        
        if p_info:
            log_activity(cur, 'deleted', pagina_id, p_info["titulo"], p_info["entidade"], user=user)

        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": "Erro ao excluir", "detalhe": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/_debug_routes", methods=["GET"])
def _debug_routes():
    return jsonify(sorted([str(r) for r in app.url_map.iter_rules()]))

@app.route("/api/relations/<int:page_id>", methods=["GET"])
def listar_relacoes_gerais(page_id):
    conn = get_conn()
    cur = conn.cursor()

    # Relações onde a página é ORIGEM
    cur.execute("""
        SELECT
            r.id AS relacao_id,
            r.tipo_relacao,
            r.destino_page_id AS related_id,
            p.titulo AS related_titulo,
            p.entidade AS related_entidade,
            p.imagem AS related_image,
            r.rotulo,
            r.data_inicio,
            r.data_fim,
            r.notas
        FROM relacoes r
        JOIN pages p ON p.id = r.destino_page_id
        WHERE r.origem_page_id = ?
    """, (page_id,))
    origem_rows = cur.fetchall()

    # Relações onde a página é DESTINO
    cur.execute("""
        SELECT
            r.id AS relacao_id,
            r.tipo_relacao,
            r.origem_page_id AS related_id,
            p.titulo AS related_titulo,
            p.entidade AS related_entidade,
            p.imagem AS related_image,
            r.rotulo,
            r.data_inicio,
            r.data_fim,
            r.notas
        FROM relacoes r
        JOIN pages p ON p.id = r.origem_page_id
        WHERE r.destino_page_id = ?
    """, (page_id,))
    destino_rows = cur.fetchall()

    conn.close()

    grupos = {}

    def adicionar_ao_grupo(row):
        tipo = row["tipo_relacao"]
        grupos.setdefault(tipo, []).append({
            "relacao_id": row["relacao_id"],
            "id": row["related_id"],
            "titulo": row["related_titulo"],
            "entidade": row["related_entidade"],
            "imagem": row["related_image"],
            "rotulo": row["rotulo"],
            "desde": row["data_inicio"],
            "ate": row["data_fim"],
            "notas": row["notas"]
        })

    for r in origem_rows:
        adicionar_ao_grupo(r)

    for r in destino_rows:
        adicionar_ao_grupo(r)

    return jsonify({
        "groups": [
            {"label": tipo, "items": items}
            for tipo, items in grupos.items()
        ]
    })
@app.route("/api/relations", methods=["POST"])
@roles_required("admin", "editor")
def criar_relacao_generica():
    data = request.get_json(silent=True) or {}

    origem = _to_int_or_none(data.get("origem_page_id"))
    destino = _to_int_or_none(data.get("destino_page_id"))
    tipo = _to_text_or_none(data.get("tipo_relacao"))

    if not origem or not destino or not tipo:
        return jsonify({"erro": "origem_page_id, destino_page_id e tipo_relacao são obrigatórios"}), 400

    rotulo = _to_text_or_none(data.get("rotulo"))
    notas = _to_text_or_none(data.get("notas"))
    desde = _to_text_or_none(data.get("data_inicio"))
    ate = _to_text_or_none(data.get("data_fim"))

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO relacoes (origem_page_id, destino_page_id, tipo_relacao, rotulo, notas, data_inicio, data_fim)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(origem_page_id, destino_page_id, tipo_relacao)
            DO UPDATE SET
              rotulo=excluded.rotulo,
              notas=excluded.notas,
              data_inicio=excluded.data_inicio,
              data_fim=excluded.data_fim
        """, (origem, destino, tipo, rotulo, notas, desde, ate))
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": "Erro ao criar relação", "detalhe": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/relations/<int:relacao_id>", methods=["DELETE"])
@roles_required("admin", "editor")
def deletar_relacao(relacao_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM relacoes WHERE id = ?", (relacao_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ----------------------
# Posts
# ----------------------

@app.route("/api/pages/<int:page_id>/posts", methods=["GET"])
def api_listar_posts(page_id):
    tipo = (request.args.get("tipo") or "").strip().lower()
    if tipo not in ("historia", "nota"):
        return jsonify({"erro": "tipo deve ser 'historia' ou 'nota'"}), 400

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, owner_page_id, tipo, titulo, conteudo_html, ordem, criado_em, atualizado_em
        FROM posts
        WHERE owner_page_id = ? AND tipo = ?
        ORDER BY ordem ASC, id ASC
    """, (page_id, tipo))
    rows = cur.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/pages/<int:page_id>/posts", methods=["POST"])
@roles_required("admin", "editor")
def api_criar_post(page_id):
    # Verify page exists
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM pages WHERE id = ?", (page_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({"erro": "Página não encontrada"}), 404

    data = request.get_json(silent=True) or {}
    tipo = (data.get("tipo") or "").strip().lower()
    if tipo not in ("historia", "nota"):
        conn.close()
        return jsonify({"erro": "tipo deve ser 'historia' ou 'nota'"}), 400

    titulo = _to_text_or_none(data.get("titulo"))
    conteudo_html = data.get("conteudo_html") or ""

    try:
        # ordem = MAX(ordem) + 1 for this owner+tipo
        cur.execute("""
            SELECT COALESCE(MAX(ordem), -1) + 1 FROM posts
            WHERE owner_page_id = ? AND tipo = ?
        """, (page_id, tipo))
        next_ordem = cur.fetchone()[0]

        cur.execute("""
            INSERT INTO posts (owner_page_id, tipo, titulo, conteudo_html, ordem)
            VALUES (?, ?, ?, ?, ?)
        """, (page_id, tipo, titulo, conteudo_html, next_ordem))
        post_id = cur.lastrowid
        conn.commit()
        return jsonify({"ok": True, "id": post_id}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": "Erro ao criar post", "detalhe": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/posts/<int:post_id>", methods=["PUT"])
@roles_required("admin", "editor")
def api_editar_post(post_id):
    data = request.get_json(silent=True) or {}
    titulo = _to_text_or_none(data.get("titulo"))
    conteudo_html = data.get("conteudo_html") or ""

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM posts WHERE id = ?", (post_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({"erro": "Post não encontrado"}), 404

    try:
        cur.execute("""
            UPDATE posts
            SET titulo = ?, conteudo_html = ?, atualizado_em = datetime('now')
            WHERE id = ?
        """, (titulo, conteudo_html, post_id))
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/posts/<int:post_id>", methods=["DELETE"])
@roles_required("admin", "editor")
def api_excluir_post(post_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM posts WHERE id = ?", (post_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({"erro": "Post não encontrado"}), 404

    try:
        cur.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": "Erro ao excluir post", "detalhe": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/posts/<int:post_id>/reorder", methods=["POST"])
@roles_required("admin", "editor")
def api_reordenar_post(post_id):
    data = request.get_json(silent=True) or {}
    direction = (data.get("direction") or "").strip().lower()
    if direction not in ("up", "down"):
        return jsonify({"erro": "direction deve ser 'up' ou 'down'"}), 400

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT id, owner_page_id, tipo, ordem FROM posts WHERE id = ?", (post_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"erro": "Post não encontrado"}), 404

    owner_page_id = row["owner_page_id"]
    tipo = row["tipo"]
    ordem_atual = row["ordem"]

    # Find neighbour
    if direction == "up":
        cur.execute("""
            SELECT id, ordem FROM posts
            WHERE owner_page_id = ? AND tipo = ? AND ordem < ?
            ORDER BY ordem DESC LIMIT 1
        """, (owner_page_id, tipo, ordem_atual))
    else:
        cur.execute("""
            SELECT id, ordem FROM posts
            WHERE owner_page_id = ? AND tipo = ? AND ordem > ?
            ORDER BY ordem ASC LIMIT 1
        """, (owner_page_id, tipo, ordem_atual))

    neighbour = cur.fetchone()
    if not neighbour:
        conn.close()
        return jsonify({"ok": True, "noop": True})  # already at boundary

    try:
        neighbour_id = neighbour["id"]
        neighbour_ordem = neighbour["ordem"]
        # Swap orders
        cur.execute("UPDATE posts SET ordem = ? WHERE id = ?", (neighbour_ordem, post_id))
        cur.execute("UPDATE posts SET ordem = ? WHERE id = ?", (ordem_atual, neighbour_id))
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": "Erro ao reordenar", "detalhe": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/timeline/<int:tl_id>", methods=["PATCH"])
@roles_required("admin", "editor")
def api_patch_timeline_event(tl_id):
    data = request.get_json(force=True) or {}

    fields = []
    params = []

    def set_if(key, col):
        v = data.get(key, None)
        if v is not None:
            fields.append(f"{col} = ?")
            params.append(v)

    set_if("start_text", "start_text")
    set_if("title", "title")
    set_if("description", "description")
    set_if("group_name", "group_name")
    set_if("color", "color")
    set_if("sort_order", "sort_order")

    if not fields:
        return jsonify({"ok": True, "noop": True})

    params.append(tl_id)

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"UPDATE timeline_events SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()
    conn.close()

    return jsonify({"ok": True})

# --- CAMPAIGN ARCHIVE ROUTES ---

@app.route("/api/files", methods=["GET"])
@roles_required("admin", "editor", "viewer")
def api_listar_arquivos():
    conn = get_conn()
    cur = conn.cursor()
    
    page_id = request.args.get("page_id")
    q = request.args.get("q", "").strip()
    tag = request.args.get("tag", "").strip()
    file_type = request.args.get("type", "").strip()

    if page_id:
        query = """
            SELECT f.* FROM campaign_files f
            JOIN file_links fl ON f.id = fl.file_id
            WHERE fl.page_id = ?
        """
        params = [page_id]
        if q:
            query += " AND f.title LIKE ?"
            params.append(f"%{q}%")
    else:
        query = "SELECT * FROM campaign_files WHERE 1=1"
        params = []
        if q:
            query += " AND (title LIKE ? OR description LIKE ?)"
            params.extend([f"%{q}%", f"%{q}%"])
        if tag:
            query += " AND tags_text LIKE ?"
            params.append(f"%{tag}%")
        if file_type:
            query += " AND file_kind = ?"
            params.append(file_type)

    # Permission check for private files
    user = get_current_user()
    if user["role"] == "viewer":
        query += " AND is_public = 1"

    query += " ORDER BY created_at DESC"
    
    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/files", methods=["POST"])
@roles_required("admin", "editor")
def api_upload_arquivo():
    if 'file' not in request.files:
        return jsonify({"erro": "Nenhum arquivo enviado"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"erro": "Arquivo sem nome"}), 400
    
    title = request.form.get("title", file.filename)
    description = request.form.get("description", "")
    is_public = 1 if request.form.get("is_public") == "true" else 0
    tags = request.form.get("tags", "")
    page_id = request.form.get("page_id") # Optional: link immediately

    filename = secure_filename(file.filename)
    # create unique name
    unique_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
    
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])
        
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
    file.save(file_path)

    file_size = os.path.getsize(file_path)
    mime_type = file.content_type
    file_kind = 'image' if mime_type and mime_type.startswith('image/') else 'pdf' if mime_type == 'application/pdf' else 'other'

    user = get_current_user()
    
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO campaign_files (title, description, file_path, file_name, mime_type, file_kind, file_size, is_public, author_username, tags_text)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (title, description, unique_name, filename, mime_type, file_kind, file_size, is_public, user['username'], tags))
        file_id = cur.lastrowid

        if page_id:
            cur.execute("INSERT INTO file_links (file_id, page_id) VALUES (?, ?)", (file_id, page_id))
        
        conn.commit()
        return jsonify({"ok": True, "id": file_id})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/files/<int:file_id>", methods=["GET"])
@roles_required("admin", "editor", "viewer")
def api_detalhe_arquivo(file_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM campaign_files WHERE id = ?", (file_id,))
    file_row = cur.fetchone()
    
    if not file_row:
        conn.close()
        return jsonify({"erro": "Arquivo não encontrado"}), 404
    
    user = get_current_user()
    if file_row['is_public'] == 0 and user['role'] == 'viewer':
        conn.close()
        return jsonify({"erro": "Acesso negado"}), 403
    
    cur.execute("""
        SELECT p.id, p.titulo, fl.note
        FROM file_links fl
        JOIN pages p ON fl.page_id = p.id
        WHERE fl.file_id = ?
    """, (file_id,))
    links = cur.fetchall()
    conn.close()
    
    res = dict(file_row)
    res['links'] = [dict(l) for l in links]
    return jsonify(res)

@app.route("/api/files/<int:file_id>", methods=["PATCH"])
@roles_required("admin", "editor")
def api_editar_arquivo(file_id):
    data = request.get_json() or {}
    conn = get_conn()
    cur = conn.cursor()
    
    fields = []
    params = []
    for key in ['title', 'description', 'is_public', 'tags_text']:
        if key in data:
            fields.append(f"{key} = ?")
            params.append(data[key])
    
    if not fields:
        return jsonify({"ok": True, "noop": True})
    
    params.append(file_id)
    try:
        cur.execute(f"UPDATE campaign_files SET {', '.join(fields)}, updated_at = datetime('now') WHERE id = ?", params)
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/files/<int:file_id>", methods=["DELETE"])
@roles_required("admin", "editor")
def api_deletar_arquivo(file_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT file_path FROM campaign_files WHERE id = ?", (file_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"erro": "Arquivo não encontrado"}), 404
    
    try:
        # Delete physical file
        path = os.path.join(app.config['UPLOAD_FOLDER'], row['file_path'])
        if os.path.exists(path):
            os.remove(path)
        
        cur.execute("DELETE FROM campaign_files WHERE id = ?", (file_id,))
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/files/<int:file_id>/view")
@roles_required("admin", "editor", "viewer")
def api_servir_arquivo(file_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT file_path, is_public, mime_type FROM campaign_files WHERE id = ?", (file_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return "Arquivo não encontrado", 404
    
    user = get_current_user()
    if row['is_public'] == 0 and user['role'] == 'viewer':
        return "Acesso negado", 403
    
    return send_from_directory(app.config['UPLOAD_FOLDER'], row['file_path'], mimetype=row['mime_type'])

@app.route("/api/files/<int:file_id>/links", methods=["POST"])
@roles_required("admin", "editor")
def api_vincular_arquivo(file_id):
    data = request.get_json() or {}
    page_id = data.get("page_id")
    note = data.get("note", "")
    
    if not page_id:
        return jsonify({"erro": "page_id obrigatório"}), 400
    
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO file_links (file_id, page_id, note) VALUES (?, ?, ?)", (file_id, page_id, note))
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/files/<int:file_id>/links/<int:page_id>", methods=["DELETE"])
@roles_required("admin", "editor")
def api_desvincular_arquivo(file_id, page_id):
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM file_links WHERE file_id = ? AND page_id = ?", (file_id, page_id))
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()

# --- AUTH ROUTES ---

@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"erro": "Usuário e senha são obrigatórios"}), 400

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, password_hash, role, is_active FROM users WHERE username = ?", (username,))
    row = cur.fetchone()
    conn.close()

    if not row or row["is_active"] == 0:
        return jsonify({"erro": "Usuário não encontrado ou inativo"}), 401

    if not check_password_hash(row["password_hash"], password):
        return jsonify({"erro": "Senha incorreta"}), 401

    # Login sucesso
    session.permanent = True
    session["user_id"] = row["id"]
    
    # Atualiza last_login
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE users SET last_login = datetime('now') WHERE id = ?", (row["id"],))
    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "user": {
            "id": row["id"],
            "username": username,
            "role": row["role"]
        }
    })

@app.route("/api/auth/logout", methods=["POST"])
def api_logout():
    session.pop("user_id", None)
    return jsonify({"ok": True})

@app.route("/api/auth/me", methods=["GET"])
def api_me():
    user = get_current_user()
    if not user:
        return jsonify({"user": None})
    
    return jsonify({
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"]
        }
    })

# --- ADMIN ROUTES (USER MGMT) ---

@app.route("/api/admin/users", methods=["GET"])
@roles_required("admin")
def api_admin_list_users():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, username, role, created_at, last_login, is_active FROM users ORDER BY username ASC")
    rows = cur.fetchall()
    conn.close()
    return jsonify({"users": [dict(r) for r in rows]})

@app.route("/api/activity-log", methods=["GET"])
@roles_required("admin")
def api_get_activity_log():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM activity_log 
        ORDER BY timestamp DESC 
        LIMIT 50
    """)
    rows = cur.fetchall()
    conn.close()
    return jsonify({"logs": [dict(r) for r in rows]})

@app.route("/api/admin/users", methods=["POST"])
@roles_required("admin")
def api_admin_create_user():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    role = data.get("role") or "viewer"

    if not username or len(password) < 4:
        return jsonify({"erro": "Username e Senha (mín 4 chars) obrigatórios"}), 400

    if role not in ("admin", "editor", "viewer"):
        return jsonify({"erro": "Role inválido"}), 400

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO users (username, password_hash, role)
            VALUES (?, ?, ?)
        """, (username, generate_password_hash(password), role))
        conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({"erro": "Username já existe"}), 400
    finally:
        conn.close()

    return jsonify({"ok": True})

@app.route("/api/admin/users/<int:user_id>", methods=["PATCH"])
@roles_required("admin")
def api_admin_patch_user(user_id):
    data = request.get_json(silent=True) or {}
    
    fields = []
    params = []

    if "role" in data:
        if data["role"] in ("admin", "editor", "viewer"):
            fields.append("role = ?")
            params.append(data["role"])
    
    if "is_active" in data:
        current_admin = get_current_user()
        if current_admin and current_admin["id"] == user_id and not data["is_active"]:
            return jsonify({"erro": "Você não pode desativar sua própria conta de administrador"}), 403
        fields.append("is_active = ?")
        params.append(1 if data["is_active"] else 0)

    if "password" in data and len(data["password"]) >= 4:
        fields.append("password_hash = ?")
        params.append(generate_password_hash(data["password"]))

    if not fields:
        return jsonify({"ok": True, "noop": True})

    params.append(user_id)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()
    conn.close()

    return jsonify({"ok": True})

@app.route("/api/admin/timeline/cleanup", methods=["POST"])
@roles_required("admin")
def api_timeline_cleanup():
    conn = get_conn()
    cur = conn.cursor()
    try:
        # Remove events where page_id is NULL or the page no longer exists
        cur.execute("""
            DELETE FROM timeline_events
            WHERE page_id IS NULL
               OR page_id NOT IN (SELECT id FROM pages)
        """)
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": "Erro no cleanup", "detalhe": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/account", methods=["PATCH"])
def api_patch_account():
    user = get_current_user()
    if not user:
        return jsonify({"erro": "Login necessário"}), 401
    
    data = request.get_json(silent=True) or {}
    new_username = (data.get("username") or "").strip()
    
    if "username" in data:
        if len(new_username) < 3 or len(new_username) > 30:
            return jsonify({"erro": "Username deve ter entre 3 e 30 caracteres"}), 400
        
        # Permitir apenas a-z, A-Z, 0-9, . , _ e -
        import re
        if not re.match(r"^[a-zA-Z0-9._-]+$", new_username):
            return jsonify({"erro": "Username contém caracteres inválidos"}), 400
            
        conn = get_conn()
        cur = conn.cursor()
        
        # Verificar se já existe (exceto se for o mesmo user mudando so o case?)
        cur.execute("SELECT id FROM users WHERE username = ? AND id != ?", (new_username, user["id"]))
        if cur.fetchone():
            conn.close()
            return jsonify({"erro": "Username já está em uso"}), 409
            
        cur.execute("UPDATE users SET username = ? WHERE id = ?", (new_username, user["id"]))
        conn.commit()
        conn.close()
        
    return jsonify({
        "ok": True, 
        "user": {
            "id": user["id"],
            "username": new_username if "username" in data else user["username"],
            "role": user["role"]
        }
    })

@app.route("/api/account/password", methods=["POST"])
def api_account_change_password():
    user = get_current_user()
    if not user:
        return jsonify({"erro": "Login necessário"}), 401
    
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    
    if not current_password or not new_password or len(new_password) < 4:
        return jsonify({"erro": "Senha atual e nova senha (mín 4 chars) são obrigatórias"}), 400
    
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT password_hash FROM users WHERE id = ?", (user["id"],))
    row = cur.fetchone()
    
    if not row or not check_password_hash(row["password_hash"], current_password):
        conn.close()
        return jsonify({"erro": "Senha atual incorreta"}), 401
    
    cur.execute("UPDATE users SET password_hash = ? WHERE id = ?", (generate_password_hash(new_password), user["id"]))
    conn.commit()
    conn.close()
    
    return jsonify({"ok": True})

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
ensure_admin_user()
ensure_timeline_sort_order()


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)