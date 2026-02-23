import sqlite3

DB_FILE = "wiki.db"

# === Função para listar todas as páginas ===
def listar_paginas():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, tipo, titulo FROM paginas")
    paginas = cursor.fetchall()
    
    conn.close()
    return paginas

# === Função para buscar páginas por tipo ===
def buscar_por_tipo(tipo):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, titulo FROM paginas WHERE tipo = ?", (tipo,))
    paginas = cursor.fetchall()
    
    conn.close()
    return paginas

# === Função para buscar páginas por tag ===
def buscar_por_tag(tag_nome):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute("""
    SELECT p.id, p.titulo, p.tipo
    FROM paginas p
    JOIN pagina_tags pt ON p.id = pt.pagina_id
    JOIN tags t ON t.id = pt.tag_id
    WHERE t.nome = ?
    """, (tag_nome,))
    
    paginas = cursor.fetchall()
    conn.close()
    return paginas