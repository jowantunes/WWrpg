from flask import Flask, jsonify, send_from_directory, request
import sqlite3
import os

app = Flask(__name__, static_folder="frontend")
DB_FILE = "wiki.db"
def get_conn():
    conn = sqlite3.connect(DB_FILE, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn
def criar_tabelas():
    conn = get_conn()
    cursor = conn.cursor()

    # Tabela principal
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS paginas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL,
            titulo TEXT NOT NULL,
            data_criacao TEXT,
            autor TEXT
        )
    """)

    # Tabela de personagens (1 pra 1 com paginas)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS personagens (
            pagina_id INTEGER PRIMARY KEY,
            idade INTEGER,
            FOREIGN KEY (pagina_id) REFERENCES paginas(id) ON DELETE CASCADE
        )
    """)

    # Tabela de tags
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE
        )
    """)

    # Relacionamento N:N
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pagina_tags (
            pagina_id INTEGER,
            tag_id INTEGER,
            FOREIGN KEY (pagina_id) REFERENCES paginas(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()
def run_migrations():
    conn = get_conn()
    cursor = conn.cursor()

    # tabela que registra migrations já aplicadas
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS migrations (
            name TEXT PRIMARY KEY,
            applied_at TEXT DEFAULT (datetime('now'))
        )
    """)

    def applied(name: str) -> bool:
        cursor.execute("SELECT 1 FROM migrations WHERE name = ?", (name,))
        return cursor.fetchone() is not None

    def mark(name: str):
        cursor.execute("INSERT INTO migrations (name) VALUES (?)", (name,))

    # ---------------------------------------
    # MIGRAÇÃO 001: adicionar coluna classe
    # ---------------------------------------
    mig_name = "001_add_classe_to_personagens"
    if not applied(mig_name):
    # checa se coluna já existe (caso alguém tenha feito manualmente)
        cursor.execute("PRAGMA table_info(personagens)")
        cols = [row[1] for row in cursor.fetchall()]
        if "classe" not in cols:
             cursor.execute("ALTER TABLE personagens ADD COLUMN classe TEXT")
        mark(mig_name)

# ---------------------------------------
# MIGRAÇÃO 002: criar tabela personagem_organizacoes
# ---------------------------------------
    mig_name = "002_create_personagem_organizacoes"
    if not applied(mig_name):
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS personagem_organizacoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                personagem_id INTEGER NOT NULL,
                organizacao_id INTEGER NOT NULL,
                cargo TEXT,
                desde TEXT,   -- YYYY-MM-DD
                ate TEXT,     -- YYYY-MM-DD ou NULL
                status TEXT,
                notas TEXT,
                FOREIGN KEY (personagem_id) REFERENCES paginas(id) ON DELETE CASCADE,
                FOREIGN KEY (organizacao_id) REFERENCES paginas(id) ON DELETE CASCADE
            )
    """)
        mark(mig_name)

# ---------------------------------------
# MIGRAÇÃO 003: criar tabela organizacoes
# ---------------------------------------
    mig_name = "003_create_organizacoes"
    if not applied(mig_name):
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS organizacoes (
                pagina_id INTEGER PRIMARY KEY,
                FOREIGN KEY (pagina_id) REFERENCES paginas(id) ON DELETE CASCADE
            )
    """)
        mark(mig_name)

# ---------------------------------------
# MIGRAÇÃO 004: índices personagem_organizacoes
# ---------------------------------------
    mig_name = "004_add_indexes_personagem_organizacoes"
    if not applied(mig_name):
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS ux_po
            ON personagem_organizacoes(personagem_id, organizacao_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS ix_po_personagem
        ON personagem_organizacoes(personagem_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS ix_po_org
        ON personagem_organizacoes(organizacao_id)
    """)

    mark(mig_name)


    conn.commit()
    conn.close()

# ----------------------
# Rotas básicas
# ----------------------
@app.route("/api/paginas")
def listar_paginas():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, tipo, titulo, data_criacao, autor FROM paginas")
    paginas = cursor.fetchall()

    resultado = []
    for p in paginas:
        pagina_id = p[0]
        cursor.execute("""
            SELECT t.nome
            FROM pagina_tags pt
            JOIN tags t ON pt.tag_id = t.id
            WHERE pt.pagina_id = ?
        """, (pagina_id,))
        tags = [t[0] for t in cursor.fetchall()]
        resultado.append({
            "id": pagina_id,
            "tipo": p[1],
            "titulo": p[2],
            "data_criacao": p[3],
            "autor": p[4],
            "tags": tags
        })

    conn.close()
    return jsonify(resultado)

@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")



# ----------------------
# Tags
# ----------------------
@app.route("/api/paginas_tags")
def paginas_tags():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pt.pagina_id, t.nome
        FROM pagina_tags pt
        JOIN tags t ON pt.tag_id = t.id
    """)
    linhas = cursor.fetchall()
    conn.close()

    tags_dict = {}
    for pagina_id, nome_tag in linhas:
        tags_dict.setdefault(pagina_id, []).append(nome_tag)
    return jsonify(tags_dict)

# ----------------------
# Detalhes de uma página
# ----------------------
@app.route("/api/pagina/<int:pagina_id>")
def detalhes_pagina(pagina_id):
    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT id, tipo, titulo, data_criacao, autor FROM paginas WHERE id = ?", (pagina_id,))
    pagina = cursor.fetchone()
    if not pagina:
        conn.close()
        return jsonify({"erro": "Página não encontrada"}), 404

    cursor.execute("""
        SELECT t.nome
        FROM pagina_tags pt
        JOIN tags t ON pt.tag_id = t.id
        WHERE pt.pagina_id = ?
    """, (pagina_id,))
    tags = [t[0] for t in cursor.fetchall()]

    idade = None
    classe = None
    if pagina[1] == "personagem":
        cursor.execute("SELECT idade, classe FROM personagens WHERE pagina_id=?", (pagina_id,))
        result = cursor.fetchone()
        if result:
            idade = result[0]
            classe = result[1]

    conn.close()
    return jsonify({
        "id": pagina[0],
        "tipo": pagina[1],
        "titulo": pagina[2],
        "data_criacao": pagina[3],
        "autor": pagina[4],
        "tags": tags,
        "idade": idade,
        "classe": classe
    })

# ----------------------
# Criar página
# ----------------------
@app.route("/api/criar_pagina", methods=["POST"])
def criar_pagina():
    data = request.get_json() or {}
    print("DATA RECEBIDA:", data)

    tipo = data.get("tipo")
    titulo = data.get("titulo")
    autor = data.get("autor")
    tags = data.get("tags", [])

    if not titulo or not tipo:
        return jsonify({"erro": "Título e tipo são obrigatórios"}), 400

    def insert_personagem(cursor, pagina_id, data):
        idade = data.get("idade")
        classe = data.get("classe")
        cursor.execute(
            "INSERT INTO personagens (pagina_id, idade, classe) VALUES (?, ?, ?)",
            (pagina_id, idade, classe)
        )

    def insert_organizacao(cursor, pagina_id, data):
        cursor.execute(
            "INSERT INTO organizacoes (pagina_id) VALUES (?)",
            (pagina_id,)
        )

    type_handlers = {
        "personagem": insert_personagem,
        "organizacao": insert_organizacao,
    }

    handler = type_handlers.get(tipo)
    if not handler:
        return jsonify({"erro": f"Tipo inválido: {tipo}"}), 400

    conn = get_conn()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "INSERT INTO paginas (tipo, titulo, data_criacao, autor) VALUES (?, ?, datetime('now'), ?)",
            (tipo, titulo, autor)
        )
        pagina_id = cursor.lastrowid

        # Tags
        for tag_nome in tags:
            cursor.execute("SELECT id FROM tags WHERE nome = ?", (tag_nome,))
            res = cursor.fetchone()
            if res:
                tag_id = res[0]
            else:
                cursor.execute("INSERT INTO tags (nome) VALUES (?)", (tag_nome,))
                tag_id = cursor.lastrowid

            cursor.execute(
                "INSERT INTO pagina_tags (pagina_id, tag_id) VALUES (?, ?)",
                (pagina_id, tag_id)
            )

        # Campos específicos do tipo
        handler(cursor, pagina_id, data)

        conn.commit()
        return jsonify({"id": pagina_id})

    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500

    finally:
        conn.close()
# ----------------------
# Editar página
# ----------------------
@app.route("/api/editar_pagina", methods=["POST"])
def editar_pagina():
    pagina_id = request.args.get("id")
    dados = request.get_json()

    if not pagina_id:
        return jsonify({"erro": "ID da página obrigatório"}), 400

    conn = get_conn()
    cursor = conn.cursor()

    # Buscar tipo da página
    cursor.execute("SELECT tipo FROM paginas WHERE id=?", (pagina_id,))
    pagina_tipo = cursor.fetchone()[0]

    # Campos básicos
    if "titulo" in dados:
        cursor.execute("UPDATE paginas SET titulo=? WHERE id=?", (dados["titulo"], pagina_id))
    if "autor" in dados:
        cursor.execute("UPDATE paginas SET autor=? WHERE id=?", (dados["autor"], pagina_id))

    # Campos específicos
    if pagina_tipo == "personagem":
        idade = dados.get("idade")
        classe = dados.get("classe")

        cursor.execute("SELECT pagina_id FROM personagens WHERE pagina_id=?", (pagina_id,))
        if cursor.fetchone():
            cursor.execute("UPDATE personagens SET idade=?, classe=? WHERE pagina_id=?", (dados["idade"], classe, pagina_id))
        else:
            cursor.execute("INSERT INTO personagens (pagina_id, idade, classe) VALUES (?, ?, ?)", (pagina_id, dados["idade"],dados["classe"]))

    # Tags
    if "tags" in dados:
        cursor.execute("DELETE FROM pagina_tags WHERE pagina_id=?", (pagina_id,))
        for tag_nome in dados["tags"]:
            cursor.execute("SELECT id FROM tags WHERE nome=?", (tag_nome,))
            res = cursor.fetchone()
            if res:
                tag_id = res[0]
            else:
                cursor.execute("INSERT INTO tags (nome) VALUES (?)", (tag_nome,))
                tag_id = cursor.lastrowid
            cursor.execute("INSERT INTO pagina_tags (pagina_id, tag_id) VALUES (?, ?)", (pagina_id, tag_id))

    conn.commit()
    conn.close()
    return jsonify({"sucesso": True})

# ----------------------
# Excluir página
# ----------------------
@app.route("/api/excluir_pagina", methods=["POST"])
def excluir_pagina():
    pagina_id = request.args.get("id")
    if not pagina_id:
        return jsonify({"erro": "ID da página obrigatório"}), 400

    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM pagina_tags WHERE pagina_id=?", (pagina_id,))
    cursor.execute("DELETE FROM personagens WHERE pagina_id=?", (pagina_id,))
    cursor.execute("DELETE FROM paginas WHERE id=?", (pagina_id,))
    conn.commit()
    conn.close()
    return jsonify({"sucesso": True})

@app.route("/api/organizacoes")
def listar_organizacoes():
    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, titulo
        FROM paginas
        WHERE tipo = 'organizacao'
        ORDER BY titulo
    """)
    orgs = [{"id": row[0], "titulo": row[1]} for row in cursor.fetchall()]

    conn.close()
    return jsonify(orgs)
@app.route("/api/personagem/<int:personagem_id>/organizacoes", methods=["GET"])
def listar_organizacoes_do_personagem(personagem_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            po.organizacao_id,
            p.titulo AS organizacao_titulo,
            po.cargo, po.desde, po.ate, po.status, po.notas
        FROM personagem_organizacoes po
        JOIN paginas p ON p.id = po.organizacao_id
        WHERE po.personagem_id = ?
        ORDER BY p.titulo ASC
    """, (personagem_id,))
    rows = cur.fetchall()
    conn.close()

    return jsonify([{
        "organizacao_id": r[0],
        "organizacao_titulo": r[1],
        "cargo": r[2],
        "desde": r[3],
        "ate": r[4],
        "status": r[5],
        "notas": r[6],
    } for r in rows])

@app.route("/api/personagem/<int:personagem_id>/organizacoes", methods=["POST"])
def vincular_org_ao_personagem(personagem_id):
    data = request.get_json() or {}
    organizacao_id = data.get("organizacao_id")

    if not organizacao_id:
        return jsonify({"erro": "organizacao_id é obrigatório"}), 400

    cargo = data.get("cargo")
    desde = data.get("desde")
    ate = data.get("ate")
    status = data.get("status")
    notas = data.get("notas")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO personagem_organizacoes
            (personagem_id, organizacao_id, cargo, desde, ate, status, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (personagem_id, organizacao_id, cargo, desde, ate, status, notas))
        conn.commit()
        return jsonify({"ok": True})
    except sqlite3.IntegrityError as e:
        conn.rollback()
        # aqui o UNIQUE evita duplicado
        return jsonify({"erro": "Vínculo já existe ou IDs inválidos", "detail": str(e)}), 409
    finally:
        conn.close()

@app.route("/api/personagem/<int:personagem_id>/organizacoes/<int:organizacao_id>", methods=["DELETE"])
def desvincular_org(personagem_id, organizacao_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        DELETE FROM personagem_organizacoes
        WHERE personagem_id = ? AND organizacao_id = ?
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
            po.personagem_id,
            p.titulo AS personagem_titulo,
            po.cargo, po.desde, po.ate, po.status, po.notas
        FROM personagem_organizacoes po
        JOIN paginas p ON p.id = po.personagem_id
        WHERE po.organizacao_id = ?
        ORDER BY p.titulo ASC
    """, (organizacao_id,))
    rows = cur.fetchall()
    conn.close()

    return jsonify([{
        "personagem_id": r[0],
        "personagem_titulo": r[1],
        "cargo": r[2],
        "desde": r[3],
        "ate": r[4],
        "status": r[5],
        "notas": r[6],
    } for r in rows])

@app.route("/<path:path>")
def spa_fallback(path):
    if path.startswith("api/"):
        return jsonify({"erro": "Rota API não encontrada"}), 404

    full_path = os.path.join("frontend", path)
    if os.path.isfile(full_path):
        return send_from_directory("frontend", path)

    return send_from_directory("frontend", "index.html")


criar_tabelas()
run_migrations()


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)