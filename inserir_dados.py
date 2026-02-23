import sqlite3
from datetime import datetime

# Conecta ao banco
conn = sqlite3.connect("wiki.db")
cursor = conn.cursor()

# === 1. Cria uma página ===
pagina = {
    "tipo": "personagem",
    "titulo": "Arkan, o Mago",
    "descricao": "Um jovem mago talentoso com cabelos brancos.",
    "autor": "Luthor",
    "data_criacao": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
}

cursor.execute("""
INSERT INTO paginas (tipo, titulo, descricao, autor, data_criacao)
VALUES (:tipo, :titulo, :descricao, :autor, :data_criacao)
""", pagina)

pagina_id = cursor.lastrowid
print(f"Página criada com ID {pagina_id}")

# === 2. Adiciona tags ===
tags = ["mago", "cabeludo", "protagonista"]

for tag_nome in tags:
    # Tenta inserir a tag (ignora se já existe)
    cursor.execute("""
    INSERT OR IGNORE INTO tags (nome) VALUES (?)
    """, (tag_nome,))
    
    # Pega o id da tag
    cursor.execute("SELECT id FROM tags WHERE nome = ?", (tag_nome,))
    tag_id = cursor.fetchone()[0]
    
    # Vincula a página à tag
    cursor.execute("""
    INSERT INTO pagina_tags (pagina_id, tag_id) VALUES (?, ?)
    """, (pagina_id, tag_id))

print("Tags vinculadas à página.")

# === 3. Adiciona dados específicos de personagem ===
personagem = {
    "pagina_id": pagina_id,
    "classe": "Mago",
    "nivel": 5
}

cursor.execute("""
INSERT INTO personagens (pagina_id, classe, nivel)
VALUES (:pagina_id, :classe, :nivel)
""", personagem)

print("Dados específicos do personagem adicionados.")

# Salva e fecha
conn.commit()
conn.close()