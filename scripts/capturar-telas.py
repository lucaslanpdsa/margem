"""
Captura as telas do Margem a partir da prévia (/dev), para a documentação (docs/img).

Uso (com `npm run dev` rodando):
    python3 scripts/capturar-telas.py                      # todas, em docs/img
    python3 scripts/capturar-telas.py --url http://localhost:3000 --saida /tmp/telas
    python3 scripts/capturar-telas.py --so dia,tarefas     # só algumas (pelo nome do arquivo)

Precisa do Playwright para Python com o Chromium (pip install playwright; playwright install chromium).
Celular: 390px de largura; computador: 1280x860. Imagens do celular salvas em 390px (metade do retina).
"""
import argparse
import os

from PIL import Image
from playwright.sync_api import sync_playwright

# Esconde o indicador de dev do Next e, nas capturas de página inteira, a barra fixa de baixo.
HIDE = "nextjs-portal{display:none!important}"
HIDE_NAV = HIDE + " nav.fixed{display:none!important}"

# (arquivo, endereço, ação opcional, página inteira?, esconder barra?)
SHOTS = [
    ("01-entrar", "/dev?cenario=entrar", None, True, False),
    ("02-configuracao-inicial", "/dev?cenario=onboarding", None, False, False),
    ("03-dia", "/dev", None, True, True),
    ("04-dia-detalhes", "/dev", ("button", "Detalhes"), True, True),
    ("05-o-que-voce-fez", "/dev", ("button", "O que você fez?"), False, False),
    ("06-janela-da-tarefa", "/dev?abrir=tarefa", None, False, False),
    ("07-nova-tarefa", "/dev?abrir=nova", None, False, False),
    ("08-nova-tarefa-mais-opcoes", "/dev?abrir=nova", ("button", "Mais opções: horário e como termina"), True, False),
    ("09-editar-tarefa", "/dev?abrir=editar", None, False, False),
    ("10-tarefas", "/dev#tarefas", None, True, True),
    ("11-seu-horario", "/dev#tarefas", ("title", "Mudar seu horário"), True, False),
    ("12-foco", "/dev#foco", None, False, False),
    ("13-pomodoro-config", "/dev#foco", ("button", "Configurar pomodoro"), False, False),
    ("14-foco-rodando", "/dev?cenario=timer#foco", None, False, False),
    ("15-dia-timer-rodando", "/dev?cenario=timer", None, False, False),
    ("16-como-funciona", "/dev", ("button", "Como funciona"), False, False),
    ("19-dia-apertado", "/dev?cenario=apertado", None, True, True),
    ("20-dia-vazio", "/dev?cenario=vazio", None, False, False),
]
DESKTOP = [("17-dia-computador", "/dev"), ("18-tarefas-computador", "/dev#tarefas")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:3000")
    ap.add_argument("--saida", default=os.path.join(os.path.dirname(__file__), "..", "docs", "img"))
    ap.add_argument("--so", default="", help="nomes separados por vírgula (parte do nome do arquivo)")
    a = ap.parse_args()
    only = [x for x in a.so.split(",") if x]
    want = lambda name: not only or any(o in name for o in only)
    os.makedirs(a.saida, exist_ok=True)

    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, path, action, full, hide_nav in SHOTS:
            if not want(name):
                continue
            ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="pt-BR")
            pg = ctx.new_page()
            css = HIDE_NAV if hide_nav else HIDE
            pg.add_init_script(f"document.addEventListener('DOMContentLoaded',()=>{{const s=document.createElement('style');s.textContent='{css}';document.head.appendChild(s)}})")
            pg.goto(a.url + path, wait_until="networkidle")
            pg.wait_for_timeout(1500)
            if action:
                kind, label = action
                (pg.get_by_title(label) if kind == "title" else pg.get_by_role("button", name=label)).first.click()
                pg.wait_for_timeout(400)
            out = os.path.join(a.saida, name + ".png")
            pg.screenshot(path=out, full_page=full)
            im = Image.open(out).convert("RGB")
            im.resize((im.width // 2, im.height // 2), Image.LANCZOS).save(out, optimize=True)
            ctx.close()
            print("ok", name)
        for name, path in DESKTOP:
            if not want(name):
                continue
            pg = b.new_context(viewport={"width": 1280, "height": 860}, locale="pt-BR").new_page()
            pg.add_init_script(f"document.addEventListener('DOMContentLoaded',()=>{{const s=document.createElement('style');s.textContent='{HIDE}';document.head.appendChild(s)}})")
            pg.goto(a.url + path, wait_until="networkidle")
            pg.wait_for_timeout(1500)
            pg.screenshot(path=os.path.join(a.saida, name + ".png"))
            print("ok", name)
        b.close()


if __name__ == "__main__":
    main()
