#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=====================================================================
 «ВИЗУАЛЬНЫЙ АВТОР» — локальный сервер сайта
=====================================================================

 ЧЕТЫРЕ БЛОКА ПРОЕКТА:

   1. content.json  — ВСЕ данные карточек: заголовки, описания,
                      теги, ссылки. Правьте только его.
   2. templates/    — HTML-шаблоны (Jinja2): задают, как карточки
                      расположены и выглядят на странице.
   3. app.py        — ЭТОТ ФАЙЛ. Flask-сервер: отвечает на запросы
                      браузера и отдаёт ему собранную страницу.
   4. localhost     — адрес http://127.0.0.1:5000, по которому вы
                      открываете сайт. Закроете терминал — сайт
                      перестанет работать.

 ЗАПУСК:
     python3 app.py                 # http://127.0.0.1:5000
     python3 app.py --port 8080     # другой порт
     python3 app.py --host          # открыть в телефоне по Wi-Fi
     python3 app.py --reload        # автоперезапуск при правках

 ЗАЧЕМ ЧТО:
   • ВСЕ ссылки и контакты НЕ ЗАПОЛНЕНЫ намеренно — кнопки на сайте
     уже работают: они показывают подсказку «укажите в content.json».
     Заполнили поле в content.json → кнопка сразу ожила.
   • content.json перечитывается при каждом запросе: правку в JSON
     видно сразу, перезапускать сервер не нужно.
   • Заявки с формы пишутся в data/leads.json и в консоль.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import socket
import sys
from datetime import datetime
from pathlib import Path

from flask import (
    Flask,
    Response,
    abort,
    jsonify,
    redirect,
    render_template,
    request,
    url_for,
)

# =====================================================================
#  ПУТИ
# =====================================================================
BASE_DIR = Path(__file__).resolve().parent
CONTENT_FILE = BASE_DIR / "content.json"
LEADS_FILE = BASE_DIR / "data" / "leads.json"

# Папка assets/ отдаётся как /static — это стили, скрипты, картинки,
# маскоты нейросетей и обложки. Она уже собрана и работает.
app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "assets"),
    static_url_path="/static",
)

app.config["JSON_AS_ASCII"] = False
app.config["TEMPLATES_AUTO_RELOAD"] = True

# Хранилище заявок в подписи пользователей — только для локального показа
app.secret_key = os.environ.get("SECRET_KEY", "local-dev-only")


# =====================================================================
#  БЛОК 1. ЧТЕНИЕ content.json
# =====================================================================
_cache: dict = {"mtime": None, "data": None}


def load_content() -> dict:
    """Читает content.json. Кэш по времени изменения — файл
    перечитывается только если он изменился (правки видны сразу)."""
    if not CONTENT_FILE.exists():
        abort(
            500,
            description=(
                f"Не найден файл {CONTENT_FILE.name}. "
                "Он обязателен — в нём лежат все данные сайта."
            ),
        )
    mtime = CONTENT_FILE.stat().st_mtime
    if _cache["mtime"] != mtime or _cache["data"] is None:
        try:
            _cache["data"] = json.loads(CONTENT_FILE.read_text(encoding="utf-8"))
            _cache["mtime"] = mtime
        except json.JSONDecodeError as exc:
            abort(
                500,
                description=(
                    f"В {CONTENT_FILE.name} ошибка JSON: {exc}. "
                    "Чаще всего это лишняя запятая или не закрытая кавычка. "
                    "Проверьте файл — например, командой "
                    f"`python3 -m json.tool {CONTENT_FILE.name}`"
                ),
            )
    return _cache["data"]


# =====================================================================
#  ХЕЛПЕРЫ ДЛЯ ШАБЛОНОВ
# =====================================================================
def get_section(name: str, default=None):
    """Достаёт секцию из content.json.

    НЕ вызывает abort даже при сломанном JSON — просто отдаёт
    значение по умолчанию. Иначе страница 404 (она тоже рендерит
    base.html с хедером и кнопками) падала бы в рекурсию ошибок.

    Там, где сбой данных означает настоящую ошибку, используем
    load_content() напрямую — он прерывает рендер с 500."""
    value = _snapshot().get(name, default)
    return default if value is None else value


def _snapshot() -> dict:
    """Данные сайта для регистрации глобалов Jinja.

    В отличие от load_content() НИКОГДА не вызывает abort: при
    сломанном JSON просто отдаёт пустой словарь. Иначе ошибка
    возникает на старте сервера, и страницу с объяснением
    показать уже нечем."""
    try:
        return load_content()
    except Exception:  # noqa: BLE001
        return {}


def _safe_brand() -> str:
    """Название сайта для страницы ошибки.

    Читаем JSON напрямую, а не через load_content(): если файл
    сломан, load_content() выбросит abort(500) — и мы попадём
    в рекурсию. Здесь любая ошибка просто даёт запасной вариант."""
    try:
        data = json.loads(CONTENT_FILE.read_text(encoding="utf-8"))
        return str(data.get("site", {}).get("brand") or "Сайт")
    except Exception:  # noqa: BLE001 — тут любая ошибка не страшна
        return "Сайт"


def cta_url(key: str) -> str:
    """Ссылка кнопки из content.json → cta. Если поле пустое — ''.

    Пустая ссылка — это нормальное состояние v1: шаблон ставит
    класс is-empty и подсказку, но кнопка остаётся кликабельной."""
    return (get_section("cta", {}).get(key) or "").strip()


def contact_value(key: str) -> str:
    return (get_section("contacts", {}).get(key) or "").strip()


def contact_href(key: str) -> str:
    """Готовая ссылка для контакта. Пустое значение → '#'."""
    raw = contact_value(key)
    if not raw:
        return "#"
    if re.match(r"^(https?:|mailto:|tel:)", raw):
        return raw
    return "https://" + raw


def contact_text(key: str, dash: str = "—") -> str:
    return contact_value(key) or dash


def is_filled(key: str) -> bool:
    return bool(cta_url(key))


def cat_label(key: str) -> str:
    cats = get_section("service_categories", {})
    return cats.get(key, key)


def asset(path: str) -> str:
    """assets/img/x.svg → /static/img/x.svg"""
    if not path:
        return ""
    rel = path.split("assets/", 1)[-1].lstrip("/")
    return url_for("static", filename=rel)


def tag_list(tags) -> str:
    """Список тегов → 'a | b | c' для атрибута data-tags в JS-карусели."""
    if isinstance(tags, str):
        tags = [tags]
    return " | ".join(t for t in (tags or []) if t)


# --- регистрируем всё, что нужно шаблонам -----------------------------
# Значения читаем ОДИН раз при старте, а не на каждый запрос:
# иначе сломанный content.json роняет сервер ещё на этапе
# регистрации глобалов — до того, как отработает обработчик 500.
app.jinja_env.globals.update(
    site=_snapshot().get("site", {}),
    contacts=_snapshot().get("contacts", {}),
    nav_items=_snapshot().get("nav", []),
    footer_data=_snapshot().get("footer", {}),
    services=_snapshot().get("services", []),
    service_categories=_snapshot().get("service_categories", {}),
    cta_url=cta_url,
    contact_href=contact_href,
    contact_text=contact_text,
    contact_value=contact_value,
    is_filled=is_filled,
    cat_label=cat_label,
    asset=asset,
    tag_list=tag_list,
    section=get_section,
    now_year=datetime.now().year,
)


@app.template_filter("nl2br")
def nl2br(value) -> str:
    """Переводы строк из JSON → <br>"""
    if not value:
        return ""
    from markupsafe import Markup, escape

    return Markup("<br>".join(escape(value).split("\n")))


@app.template_filter("money")
def money(value) -> str:
    """Пустая цена ('', '—', '— ₽') → аккуратный прочер."""
    v = (value or "").strip()
    return v if v and v not in {"—", "— ₽", "0"} else "—"


# =====================================================================
#  ПОДДЕРЖКА СТРАНИЦЫ ЗАПРОСА
# =====================================================================
PAGES = {
    "index": "index.html",
    "program": "program.html",
    "tariffs": "tariffs.html",
    "cases": "cases.html",
    "about": "about.html",
    "faq": "faq.html",
    "contacts": "contacts.html",
}


@app.context_processor
def inject_page() -> dict:
    """Активный пункт меню и title — чтобы не дублировать в каждом шаблоне."""
    page = request.endpoint or "index"
    return {"page": page, "page_title": PAGES.get(page, "index.html")}


# =====================================================================
#  БЛОК 3. МАРШРУТЫ — ОТВЕТЫ БРАУЗЕРУ
# =====================================================================
@app.route("/")
def index():
    return render_template("index.html", data=load_content())


@app.route("/program")
def program():
    return render_template("program.html", data=load_content())


@app.route("/tariffs")
def tariffs():
    return render_template("tariffs.html", data=load_content())


@app.route("/cases")
def cases():
    return render_template("cases.html", data=load_content())


@app.route("/about")
def about():
    return render_template("about.html", data=load_content())


@app.route("/faq")
def faq():
    return render_template("faq.html", data=load_content())


@app.route("/contacts")
def contacts():
    return render_template("contacts.html", data=load_content())


@app.route("/privacy")
def privacy():
    return render_template("privacy.html", data=load_content())


@app.route("/offer")
def offer():
    return render_template("offer.html", data=load_content())


@app.route("/sitemap")
def sitemap():
    return render_template("sitemap.html", data=load_content())


# --- служебное --------------------------------------------------------
@app.route("/healthz")
def healthz():
    """Проверка, что сервер жив. Полезно для скриптов."""
    return jsonify(status="ok", content=CONTENT_FILE.name)


@app.route("/api/content")
def api_content():
    """Все данные сайта одним JSON — удобно отдавать во внешние сервисы."""
    return jsonify(load_content())


@app.route("/api/leads")
def api_leads():
    """Список сохранённых заявок (локально, для проверки формы)."""
    if not LEADS_FILE.exists():
        return jsonify([])
    return jsonify(json.loads(LEADS_FILE.read_text(encoding="utf-8")))


# =====================================================================
#  ПРИЁМ ЗАЯВОК С ФОРМЫ
# =====================================================================
def save_lead(payload: dict) -> None:
    LEADS_FILE.parent.mkdir(parents=True, exist_ok=True)
    current = []
    if LEADS_FILE.exists():
        try:
            current = json.loads(LEADS_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            current = []
    payload = {**payload, "created_at": datetime.now().isoformat(timespec="seconds")}
    current.append(payload)
    LEADS_FILE.write_text(
        json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("\n  ┌─ НОВАЯ ЗАЯВКА " + "─" * 44)
    for k, v in payload.items():
        print(f"  │ {k:<12} {v}")
    print("  └" + "─" * 59 + "\n")


@app.route("/api/lead", methods=["POST"])
def api_lead():
    """Принимает заявку с формы.

    Работает сразу, без настройки: заявка пишется в data/leads.json
    и печатается в терминал. Когда появится реальный обработчик —
    укажите его в content.json → form.endpoint.
    """
    data = request.get_json(silent=True) or request.form.to_dict() or {}

    name = (data.get("name") or "").strip()
    contact = (data.get("contact") or "").strip()

    if not name:
        return jsonify({"ok": False, "error": "Укажите имя"}), 400
    if not contact:
        return jsonify({"ok": False, "error": "Укажите Telegram или почту"}), 400

    email = (data.get("email") or "").strip()
    if email and not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$", email):
        return jsonify({"ok": False, "error": "Проверьте адрес почты"}), 400

    lead = {
        "name": name,
        "contact": contact,
        "email": email,
        "tariff": (data.get("tariff") or "").strip(),
        "task": (data.get("task") or "").strip(),
        "consent": str(data.get("consent", "")).lower() in {"1", "true", "on", "yes"},
    }

    # Если в content.json указан внешний обработчик — отдаём заявку туда.
    endpoint = (get_section("form", {}).get("endpoint") or "").strip()
    if endpoint:
        try:
            import urllib.request

            req = urllib.request.Request(
                endpoint,
                data=json.dumps(lead, ensure_ascii=False).encode("utf-8"),
                headers={"Content-Type": "application/json; charset=utf-8"},
            )
            urllib.request.urlopen(req, timeout=8).read()
        except Exception as exc:  # noqa: BLE001 — внешний сервис может упасть
            print(f"  ! Внешний обработчик не ответил: {exc}")
            return jsonify({"ok": False, "error": "Не удалось отправить заявку"}), 502
    else:
        save_lead(lead)

    return jsonify({"ok": True})


# =====================================================================
#  SEO-ФАЙЛЫ (генерируются из content.json → site.domain)
# =====================================================================
@app.route("/sitemap.xml")
def sitemap_xml():
    domain = (get_section("site", {}).get("domain") or "").rstrip("/")
    base = domain or "https://example.com"
    urls = [("", "1.0"), ("/program", "0.9"), ("/cases", "0.9"), ("/tariffs", "0.8"),
            ("/about", "0.7"), ("/faq", "0.7"), ("/contacts", "0.7"),
            ("/privacy", "0.3"), ("/offer", "0.3")]
    body = "".join(
        f"<url><loc>{base}{p}</loc><priority>{pr}</priority></url>" for p, pr in urls
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{body}</urlset>"
    )
    if not domain:
        xml = xml.replace(
            "<?xml",
            "<!-- ВНИМАНИЕ: впишите домен в content.json → site.domain -->\n<?xml",
            1,
        )
    return Response(xml, mimetype="application/xml")


@app.route("/robots.txt")
def robots_txt():
    domain = (get_section("site", {}).get("domain") or "").rstrip("/")
    base = domain or "https://example.com"
    return Response(
        "User-agent: *\nAllow: /\n\nSitemap: " + base + "/sitemap.xml\n",
        mimetype="text/plain",
    )


# =====================================================================
#  ОШИБКИ
# =====================================================================
@app.errorhandler(404)
def err_404(_e):
    # Сломанный content.json не должен ломать и 404: если файл не
    # читается — отдаём страницу с минимумом данных.
    try:
        data = load_content()
    except Exception:  # noqa: BLE001
        data = {}
    return render_template("404.html", data=data), 404


@app.errorhandler(500)
def err_500(e):
    """Страница ошибки.

    Шаблон error.html НЕ зависит от content.json — иначе сломанный
    JSON приводил бы к падению второй раз, на рендере самой
    страницы ошибки, и пользователь увидел бы пустой экран.
    Сообщение передаём напрямую."""
    msg = getattr(e, "description", "") or "Что-то пошло не так."
    brand = _safe_brand()
    return render_template("error.html", message=msg, brand=brand), 500


# =====================================================================
#  БЛОК 4. ЗАПУСК НА LOCALHOST
# =====================================================================
def lan_ip() -> str:
    """IP компьютера в локальной сети — чтобы открыть сайт в телефоне."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Локальный сервер сайта «Визуальный Автор»."
    )
    ap.add_argument("--port", "-p", type=int, default=5000, help="порт (по умолчанию 5000)")
    ap.add_argument("--host", action="store_true",
                    help="слушать во всей сети — сайт откроется в телефоне по Wi-Fi")
    ap.add_argument("--debug", action="store_true", help="режим отладки с трассировкой")
    ap.add_argument("--reload", action="store_true", help="перезапуск при изменении файлов")
    args = ap.parse_args()

    host = "0.0.0.0" if args.host else "127.0.0.1"

    print("\n" + "═" * 62)
    print("  ВИЗУАЛЬНЫЙ АВТОР — сайт запущен")
    print("═" * 62)
    print(f"  Блок 1  данные      → {CONTENT_FILE.name}")
    print(f"  Блок 2  шаблоны     → templates/")
    print(f"  Блок 3  сервер      → app.py (Flask)")
    print("  Блок 4  адрес       → " + "─" * 30)
    print(f"        \033[1;92mhttp://127.0.0.1:{args.port}\033[0m   ← откройте в браузере")
    if args.host:
        print(f"        http://{lan_ip()}:{args.port}   ← с телефона по Wi-Fi")
    print("─" * 62)
    print("  Остановить сервер: Ctrl+C в этом окне")
    print("═" * 62 + "\n")

    if not CONTENT_FILE.exists():
        print(f"  ! Не найден {CONTENT_FILE.name} — сайт не откроется.\n")

    app.run(
        host=host,
        port=args.port,
        debug=args.debug or args.reload,
        use_reloader=args.reload,
    )


if __name__ == "__main__":
    main()