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

## 🔐 Где взять все API-ключи

Carousel Pro **не хранит ключи на сервере** — все ключи задаются пользователем в UI и сохраняются в `localStorage` браузера. Это плюс безопасности (сервер не видит твоих ключей), но нужно собрать их самостоятельно. Вот пошаговая инструкция.

### 1️⃣ OpenRouter API Key — для текстовой генерации (2 минуты)

[OpenRouter](https://openrouter.ai/) — агрегатор LLM (GPT-4, Claude, Gemini, Llama и десятки других моделей через один API).

1. Регистрируйся на https://openrouter.ai
2. Войди → правый верхний угол → **Keys** → **Create Key**
3. **Name:** `carousel-pro` (любое)
4. Скопируй ключ — формат `sk-or-v1-...`. Это вводится в **Настройки → OpenRouter API Key**.

> 💰 OpenRouter работает по pay-per-use модели. Положи $5-10 на счёт — этого хватает на сотни генераций.

### 2️⃣ Kie.ai API Key — для генерации изображений (3 минуты)

[Kie.ai](https://kie.ai/) — сервис генерации изображений через AI (Flux, SDXL, MidJourney-аналоги).

1. Регистрируйся на https://kie.ai/
2. Подтверди email
3. Personal Cabinet → **API Keys** → **Create new key**
4. Скопируй ключ. Это вводится в **Настройки → Kie.ai API Key**.

> 💰 Бесплатно при регистрации обычно даётся стартовый кредит. Дальше — оплата по тарифу.

### 3️⃣ Google Gemini API Key — альтернативный вариант для картинок и текста (2 минуты)

> ⚠️ Gemini работает только через **backend-прокси** (см. PROXY_URL ниже), потому что Google API заблокирован для запросов из РФ.

1. Открой https://aistudio.google.com/apikey
2. Войди в Google-аккаунт
3. **Create API key** → выбери проект (или создай новый)
4. Скопируй ключ — формат `AIza...`. Это вводится в **Настройки → Gemini API Key**.

> 💰 Gemini бесплатен в пределах большой квоты (миллионы токенов/месяц).

### 4️⃣ Telegram Bot Token + Channel ID — для публикации каруселей в канал (5 минут)

Чтобы готовую карусель сразу отправить в свой Telegram-канал, нужен бот с правами админа.

**4а. Бот:**
1. Открой [@BotFather](https://t.me/BotFather)
2. `/newbot` → имя → username (заканчивается на `bot`)
3. Скопируй токен — формат `1234567890:ABC...`. Вводится в **Настройки → Telegram Bot Token**.

**4б. Канал:**
1. Создай Telegram-канал (или используй существующий)
2. Добавь созданного бота в **Администраторы** канала с правом «Публиковать сообщения»
3. Узнай ID канала: можно через [@username_to_id_bot](https://t.me/username_to_id_bot) — отправь ему `@your_channel`
4. Channel ID — обычно отрицательное число формата `-100xxxxxxxxxx`. Вводится в **Настройки → Channel ID**.

### 5️⃣ PROXY_URL — для запросов Gemini из РФ (только серверная часть)

Если твой VPS находится **в РФ** или на IP под санкциями — нужен внешний HTTP-прокси для запросов Gemini API. Подробнее: см. раздел [«Где взять прокси»](#-где-взять-прокси) ниже.

---

## 🚀 Запуск

### Требования
- VPS с Docker + docker-compose plugin
- Существующий стек **n8n + Traefik** на этом же VPS (Carousel-Pro подключается к их сети `n8n_default` для маршрутизации и SSL)
- Прокси-URL для Gemini API (если запускаешь из РФ)
- Домен с A-записью на этот VPS (для автоматического выпуска SSL)
- API-ключи из раздела «Где взять все API-ключи» выше (вводятся в UI после первого открытия сайта)

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
