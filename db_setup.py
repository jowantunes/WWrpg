import sqlite3

# Conecta ou cria o banco de dados
conn = sqlite3.connect("wiki.db")
cursor = conn.cursor()

# Tabela principal: paginas
cursor.execute("""
CREATE TABLE IF NOT EXISTS paginas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    autor TEXT,
    data_criacao TEXT
)
""")

# Tabela de tags
cursor.execute("""
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE
)
""")

# Tabela de ligação muitos-para-muitos
cursor.execute("""
CREATE TABLE IF NOT EXISTS pagina_tags (
    pagina_id INTEGER,
    tag_id INTEGER,
    FOREIGN KEY (pagina_id) REFERENCES paginas(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (pagina_id, tag_id)
)
""")

# Exemplos de tabelas específicas por tipo
cursor.execute("""
CREATE TABLE IF NOT EXISTS personagens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pagina_id INTEGER UNIQUE,
    classe TEXT,
    nivel INTEGER,
    FOREIGN KEY (pagina_id) REFERENCES paginas(id) ON DELETE CASCADE
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pagina_id INTEGER UNIQUE,
    raridade TEXT,
    peso REAL,
    valor REAL,
    FOREIGN KEY (pagina_id) REFERENCES paginas(id) ON DELETE CASCADE
)
""")

# Salva e fecha
conn.commit()
conn.close()

print("Banco wiki.db criado com sucesso!")