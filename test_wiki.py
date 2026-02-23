from wiki_funcs import listar_paginas, buscar_por_tipo, buscar_por_tag

print("=== Todas as páginas ===")
for p in listar_paginas():
    print(p)

print("\n=== Personagens ===")
for p in buscar_por_tipo("personagem"):
    print(p)

print("\n=== Páginas com tag 'mago' ===")
for p in buscar_por_tag("mago"):
    print(p)