from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path(__file__).resolve().parent.parent / "qa"
out.mkdir(exist_ok=True)
errors: list[str] = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto("http://127.0.0.1:5173/", wait_until="networkidle", timeout=120000)
    page.wait_for_selector("canvas", timeout=60000)
    page.wait_for_timeout(2800)
    page.screenshot(path=str(out / "01-menu.png"))

    canvas = page.locator("canvas")
    box = canvas.bounding_box()
    assert box

    def click(x: float, y: float) -> None:
        page.mouse.click(box["x"] + x, box["y"] + y)

    click(470, 338)
    page.wait_for_timeout(900)
    page.screenshot(path=str(out / "02-map.png"))

    click(1280 * 0.17, 720 * 0.78)
    page.wait_for_timeout(2200)
    page.screenshot(path=str(out / "03-battle.png"))

    for i in range(10):
        click(640 + (i % 5 - 2) * 118, 662)
        page.wait_for_timeout(280)
    page.wait_for_timeout(4500)
    page.screenshot(path=str(out / "04-combat.png"))

    click(30, 22)
    page.wait_for_timeout(700)
    click(90, 40)
    page.wait_for_timeout(500)
    click(810, 338)
    page.wait_for_timeout(900)
    page.screenshot(path=str(out / "05-heroes.png"))

    click(90, 36)
    page.wait_for_timeout(500)
    click(470, 488)
    page.wait_for_timeout(900)
    page.screenshot(path=str(out / "06-shop.png"))

    print("errors:", errors)
    browser.close()

if errors:
    raise SystemExit(2)
