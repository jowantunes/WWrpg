from flask import Flask, jsonify, send_from_directory, request
import sqlite3
import os

app = Flask(__name__, static_folder="frontend")
DB_FILE = "wiki.db"

# ----------------------
# Rotas básicas
# ----------------------
@app.route("/paginas")
def listar_paginas():
    conn = sqlite3.connect(DB_FILE)
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

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("frontend", path)

# ----------------------
# Tags
# ----------------------
@app.route("/paginas_tags")
def paginas_tags():
    conn = sqlite3.connect(DB_FILE)
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
@app.route("/pagina/<int:pagina_id>")
def detalhes_pagina(pagina_id):
    conn = sqlite3.connect(DB_FILE)
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
    if pagina[1] == "personagem":
        cursor.execute("SELECT idade FROM personagens WHERE pagina_id=?", (pagina_id,))
        result = cursor.fetchone()
        if result:
            idade = result[0]

    conn.close()
    return jsonify({
        "id": pagina[0],
        "tipo": pagina[1],
        "titulo": pagina[2],
        "data_criacao": pagina[3],
        "autor": pagina[4],
        "tags": tags,
        "idade": idade
    })

# ----------------------
# Criar página
# ----------------------
@app.route("/criar_pagina", methods=["POST"])
def criar_pagina():
    data = request.get_json()
    tipo = data.get("tipo")
    titulo = data.get("titulo")
    autor = data.get("autor")
    tags = data.get("tags", [])

    if not titulo or not tipo:
        return jsonify({"erro": "Título e tipo são obrigatórios"}), 400

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("INSERT INTO paginas (tipo, titulo, data_criacao, autor) VALUES (?, ?, datetime('now'), ?)",
                   (tipo, titulo, autor))
    pagina_id = cursor.lastrowid

    # Inserir tags
    for tag_nome in tags:
        cursor.execute("SELECT id FROM tags WHERE nome = ?", (tag_nome,))
        res = cursor.fetchone()
        if res:
            tag_id = res[0]
        else:
            cursor.execute("INSERT INTO tags (nome) VALUES (?)", (tag_nome,))
            tag_id = cursor.lastrowid
        cursor.execute("INSERT INTO pagina_tags (pagina_id, tag_id) VALUES (?, ?)", (pagina_id, tag_id))

    # Inserir idade se for personagem
    if tipo == "personagem" and "idade" in data:
        cursor.execute("INSERT INTO personagens (pagina_id, idade) VALUES (?, ?)", (pagina_id, data["idade"]))

    conn.commit()
    conn.close()
    return jsonify({"id": pagina_id})

# ----------------------
# Editar página
# ----------------------
@app.route("/editar_pagina", methods=["POST"])
def editar_pagina():
    pagina_id = request.args.get("id")
    dados = request.get_json()

    if not pagina_id:
        return jsonify({"erro": "ID da página obrigatório"}), 400

    conn = sqlite3.connect(DB_FILE)
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
    if pagina_tipo == "personagem" and "idade" in dados:
        cursor.execute("SELECT pagina_id FROM personagens WHERE pagina_id=?", (pagina_id,))
        if cursor.fetchone():
            cursor.execute("UPDATE personagens SET idade=? WHERE pagina_id=?", (dados["idade"], pagina_id))
        else:
            cursor.execute("INSERT INTO personagens (pagina_id, idade) VALUES (?, ?)", (pagina_id, dados["idade"]))

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
@app.route("/excluir_pagina", methods=["POST"])
def excluir_pagina():
    pagina_id = request.args.get("id")
    if not pagina_id:
        return jsonify({"erro": "ID da página obrigatório"}), 400

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM pagina_tags WHERE pagina_id=?", (pagina_id,))
    cursor.execute("DELETE FROM personagens WHERE pagina_id=?", (pagina_id,))
    cursor.execute("DELETE FROM paginas WHERE id=?", (pagina_id,))
    conn.commit()
    conn.close()
    return jsonify({"sucesso": True})


if __name__ == "__main__":
    app.run(debug=True)