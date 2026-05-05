# 🎨 Carousel Pro — AI-Studio для Telegram-каруселей

> **Что делает:** веб-приложение для создания контент-каруселей (картинки + текст) с использованием AI. Использует **Gemini** (Google) для генерации текста и [Kie.ai](https://kie.ai/) для генерации изображений. Готовые карусели можно отправить прямо в Telegram через свой бот.

**Сайт:** https://carouselspro.ru

---

## ✨ Возможности

- 🤖 **Генерация текста через Gemini** (Google) — заголовки, описания, посты
- 🖼️ **Генерация изображений через Kie.ai** — обложки и слайды для карусели
- 🎯 **OpenRouter** — запасной канал для текстовых LLM
- 📤 **Прямая публикация в Telegram** через настраиваемый бот
- 📦 **Экспорт в ZIP** — скачать всю карусель пачкой
- 🌍 **Мультиязычность** — RU/EN
- 🔧 **Полностью клиентское приложение** — все API-ключи задаются пользователем в UI, на сервере не хранятся

---

## 🏗 Архитектура

```
┌──────────────────────────────────────────┐
│  Браузер пользователя                    │
│  - Frontend: React + Vite                │
│  - API ключи в localStorage              │
└─────┬────────────────────────────────────┘
      │
      │  HTTPS (carouselspro.ru)
      │
┌─────▼────────────────────────────────────┐
│  Traefik (n8n_default network)           │
│  - SSL via Let's Encrypt                 │
│  - / → frontend (nginx alpine)           │
│  - /api/* → backend                      │
└─────┬────────────────────────────────────┘
      │
      ├── frontend (nginx:alpine, port 80)
      │   └── статика собранная Vite
      │
      └── backend (node:20-alpine, port 3001)
          └── proxy для Gemini API через
              ProxyAgent (PROXY_URL из .env)
```

**Зачем backend:** Gemini API заблокирован для запросов из РФ. Backend — тонкий прокси, который перенаправляет запросы Gemini через настраиваемый внешний прокси.

---

## 🛠 Технологический стек

| Компонент | Технология |
|---|---|
| Frontend | React 19 + Vite 6 + TypeScript |
| UI | TailwindCSS, lucide-react |
| AI SDK (frontend) | @google/genai |
| Архивация | jszip |
| Backend | Node.js 20 + Express + undici (для HTTP-прокси) |
| Контейнер | Docker + docker-compose |
| Reverse proxy | Traefik 2.10 (внешняя сеть `n8n_default`) |
| SSL | Let's Encrypt (через Traefik автоматически) |

---

## 📂 Структура проекта

```
carousel-pro/
├── frontend/                   # React SPA
│   ├── App.tsx                 # главный компонент
│   ├── index.html, index.tsx
│   ├── services/
│   │   ├── geminiService.ts    # вызовы Gemini через свой backend
│   │   └── generationService.ts # OpenRouter, Kie.ai, Telegram
│   ├── translations.ts         # RU/EN
│   ├── defaultPrompts.ts       # промпты по умолчанию
│   ├── nginx.conf              # nginx-конфиг для раздачи статики
│   ├── Dockerfile              # multi-stage: builder + nginx:alpine
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                    # Прокси для Gemini API
│   ├── server.js               # Express, ~50 строк
│   ├── Dockerfile              # node:20-alpine
│   └── package.json
│
├── data/                       # bind-mount (зарезервировано, сейчас пусто)
├── scripts/
│   └── update.sh               # обновление с git pull
│
├── .env                        # PROXY_URL (НЕ в git, chmod 600)
├── .env.example                # шаблон
├── docker-compose.yml          # оба сервиса + Traefik labels
├── README.md
└── LICENSE
```

---

## 🚀 Запуск

### Требования
- VPS с Docker + docker-compose plugin
- Существующий стек **n8n + Traefik** на этом же VPS (Carousel-Pro подключается к их сети `n8n_default` для маршрутизации и SSL)
- Прокси-URL для Gemini API (если запускаешь из РФ)
- Домен с A-записью на этот VPS (для автоматического выпуска SSL)

### Установка

```bash
git clone git@github.com:alexbel74/carousels.git carousel-pro
cd carousel-pro

cp .env.example .env
chmod 600 .env
nano .env   # заполнить PROXY_URL

docker compose up -d --build
docker compose logs -f
```

### Проверка
В логах ожидается:
```
backend: Using proxy: http://...****@host:port
backend: Proxy server running on port 3001
frontend: nginx started
```

Открыть https://carouselspro.ru — должна открыться React-страница.
Health-check: `curl https://carouselspro.ru/api/health` → `{"status":"ok","proxy":true}`

---

## 🐳 Управление

```bash
# Логи (live)
docker compose logs -f
docker compose logs -f frontend     # только фронт
docker compose logs -f backend      # только backend-прокси

# Перезапуск после .env
docker compose restart backend

# Перезапуск после кода
docker compose down && docker compose up -d --build

# Войти в backend
docker compose exec backend sh
```

---

## 🔄 Обновление

```bash
cd /opt/carousel-pro
./scripts/update.sh
```

или вручную:
```bash
git pull && docker compose up -d --build
```

---

## 🔐 Где взять прокси

Backend нужен прокси-URL только если запускаешь из РФ (где Gemini API заблокирован).

**Варианты:**
- VPS вне РФ (например, своя зарубежная VDS) с настроенным HTTP-прокси (3proxy, squid)
- Готовые приватные прокси (платные сервисы, ищи «приватные HTTPS прокси»)
- Бесплатные публичные прокси (НЕ рекомендую — нестабильно, могут логировать запросы с твоим Gemini-ключом)

Формат `PROXY_URL`:
```
http://username:password@host:port
```

Если запускаешь на VPS вне РФ — оставь `PROXY_URL=` пустым, запросы пойдут напрямую к Gemini.

---

## 🚚 Перенос на другой VPS

```bash
# 1. На текущем VPS
cd /opt
docker compose -f carousel-pro/docker-compose.yml down
tar czf carousel-pro.tar.gz carousel-pro/

# 2. Передать
scp carousel-pro.tar.gz root@NEW_VPS:/opt/

# 3. На новом VPS — должен быть стек n8n + traefik с сетью n8n_default
ssh root@NEW_VPS
cd /opt && tar xzf carousel-pro.tar.gz
cd carousel-pro && docker compose up -d --build
```

⚠️ Если на новом VPS другой домен — поправь Host-rules в `docker-compose.yml` (`Host(`...`)`).
⚠️ Если нет n8n+Traefik — нужно либо поднять Traefik отдельно, либо подключить frontend через свой Nginx.

---

## 🔒 Безопасность

- `.env` с прокси-кредами **не в git** — `.gitignore` это обеспечивает
- Backend проксирует **только** запросы к `generativelanguage.googleapis.com` — никаких open-relay
- Все остальные сервисы (OpenRouter, Kie.ai, Telegram) фронт вызывает напрямую — backend не видит этих ключей
- API-ключи пользователя (Gemini, OpenRouter и т.д.) хранятся **только в браузере** (localStorage) — на сервере их нет
- При компрометации прокси-кредов — отозвать у поставщика, поправить `.env`, `docker compose restart backend`

---

## 📝 Лицензия

[Proprietary](LICENSE) — All rights reserved.

---

## 📧 Контакты

Автор: alexyushkevich74@gmail.com
