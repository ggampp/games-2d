"""Smoke test do PRANCHA: menu → caderno → obra 01 → construir → ensaio → laudo → sandbox.

Requer o dev server rodando (npm run dev) e playwright para Python.
    python scripts/playtest.py
"""

from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / "qa"
OUT.mkdir(exist_ok=True)
URL = "http://127.0.0.1:5174/"


def canvas_xy(canvas, x: float, y: float) -> tuple[float, float]:
    box = canvas.bounding_box()
    assert box
    return box["x"] + x * box["width"] / 1600, box["y"] + y * box["height"] / 900


def drag(page, canvas, a, b, steps=12):
    ax, ay = canvas_xy(canvas, *a)
    bx, by = canvas_xy(canvas, *b)
    page.mouse.move(ax, ay)
    page.mouse.down()
    page.mouse.move(bx, by, steps=steps)
    page.mouse.up()
    page.wait_for_timeout(120)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 900})
        logs: list[str] = []
        page.on("pageerror", lambda err: logs.append(f"pageerror {err}"))
        page.on(
            "console",
            lambda msg: logs.append(f"{msg.type} {msg.text}") if msg.type in ("error", "warning") else None,
        )
        page.goto(URL, wait_until="domcontentloaded", timeout=20000)
        page.evaluate("localStorage.clear()")
        page.reload(wait_until="load")
        page.wait_for_selector("#btn-new", timeout=10000)
        page.wait_for_timeout(1500)
        page.screenshot(path=OUT / "01-menu.png")

        page.click("#btn-new")
        page.wait_for_selector("#screen-caderno.is-on")
        page.screenshot(path=OUT / "02-caderno.png")
        page.click(".obra:not([disabled])")
        page.wait_for_selector("#screen-briefing.is-on")
        page.screenshot(path=OUT / "03-briefing.png")

        page.click("#btn-start-project")
        page.wait_for_selector("#screen-play.is-on")
        page.wait_for_timeout(400)
        page.screenshot(path=OUT / "04-build.png")

        canvas = page.locator("#game")
        layout = page.evaluate("(() => { return { w: 1600 }; })()")
        assert layout
        # Obra 01: vão 14 m, ppm 48, leftX centrado
        ppm = 48
        left_x = round((1600 - 14 * ppm) / 2)
        right_x = left_x + 14 * ppm
        deck_y = 410
        drag(page, canvas, (left_x, deck_y), (right_x, deck_y))
        page.screenshot(path=OUT / "05-beam.png")

        page.click("#btn-test")
        page.wait_for_timeout(2500)
        page.screenshot(path=OUT / "06-test.png")
        page.wait_for_selector("#screen-report.is-on, #screen-collapse.is-on", timeout=30000)
        page.wait_for_timeout(500)
        page.screenshot(path=OUT / "07-result.png")
        report = page.locator("#screen-report.is-on").count()
        collapse = page.locator("#screen-collapse.is-on").count()
        stars = page.locator("#rep-stars .star.is-on").count() if report else 0
        print(f"obra01 report={report} collapse={collapse} stars={stars}")
        print("laudo:", page.locator("#rep-title").inner_text() if report else page.locator("#fail-mode").inner_text())

        # Próxima obra: verifica desbloqueio e caderno
        if report:
            page.click("#btn-next")
            page.wait_for_selector("#screen-briefing.is-on")
            print("briefing:", page.locator("#brief-title").inner_text())
            page.click("#btn-start-project")
            page.wait_for_selector("#screen-play.is-on")
            page.wait_for_timeout(300)
            # Obra 02: 18 m, tabuleiro reto deve falhar
            left_x = round((1600 - 18 * ppm) / 2)
            right_x = left_x + 18 * ppm
            drag(page, canvas, (left_x, deck_y), (left_x + 9 * ppm, deck_y))
            drag(page, canvas, (left_x + 9 * ppm, deck_y), (right_x, deck_y))
            page.screenshot(path=OUT / "08-obra02-build.png")
            page.click("#btn-test")
            page.wait_for_selector("#screen-report.is-on, #screen-collapse.is-on", timeout=40000)
            page.wait_for_timeout(400)
            page.screenshot(path=OUT / "09-obra02-result.png")
            print("obra02:", "report" if page.locator("#screen-report.is-on").count() else "collapse",
                  page.locator("#fail-mode").inner_text() if page.locator("#screen-collapse.is-on").count() else "")
            if page.locator("#screen-collapse.is-on").count():
                page.click("#btn-fail-retry")
            else:
                page.click("#btn-revistar")
            page.wait_for_selector("#screen-play.is-on")
            page.click("#btn-exit")
            page.wait_for_selector("#screen-caderno.is-on")
            page.screenshot(path=OUT / "10-caderno-progresso.png")
            page.click("#btn-caderno-back")

        # Sandbox
        page.wait_for_selector("#screen-menu.is-on")
        page.click("#btn-sandbox")
        page.wait_for_selector("#screen-sandbox.is-on")
        page.select_option("#sb-biome", "canyon")
        page.screenshot(path=OUT / "11-sandbox.png")
        page.click("#btn-sb-start")
        page.wait_for_selector("#screen-briefing.is-on")
        page.click("#btn-start-project")
        page.wait_for_selector("#screen-play.is-on")
        page.wait_for_timeout(300)
        page.screenshot(path=OUT / "12-sandbox-canyon.png")
        page.keyboard.press("Escape")
        page.wait_for_selector("#screen-sandbox.is-on")
        page.click("#btn-sb-back")
        page.click("#btn-gallery")
        page.wait_for_selector("#screen-gallery.is-on")
        page.screenshot(path=OUT / "13-galeria.png")

        print("logs", "\n".join(logs[-20:]) or "(nenhum erro de console)")
        browser.close()


def run() -> None:
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print("FALHA:", str(exc).splitlines()[0])
        raise


if __name__ == "__main__":
    run()
