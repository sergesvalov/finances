# Finance Tracker Project

## Описание проекта
Full-stack приложение для учета личных финансов, импорта банковских выписок (CSV) и глубокой аналитики расходов. 
Архитектурно проект базируется на связке Python (FastAPI) + React (Vite) + PostgreSQL, упакованных в Docker.

## Стек технологий
- **Backend:** Python 3.11+, FastAPI, SQLAlchemy (ORM), Alembic (миграции), Pandas (опционально, для сложной аналитики)
- **Database:** PostgreSQL 15+
- **Frontend:** React, Vite, Tailwind CSS (или любой другой UI-фреймворк), Recharts/Chart.js (для графиков)
- **Infrastructure:** Docker, Docker Compose, Nginx

## Структура проекта
```text
finance_tracker/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── import_service.py      # Логика обработки банковских CSV
│   ├── alembic/
│   └── routers/
│       ├── transactions.py
│       ├── analytics.py       # API для агрегации данных
│       └── import_api.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    ├── nginx/
    │   └── default.conf
    └── src/
        ├── App.jsx
        ├── api.js
        └── components/
            ├── Dashboard.jsx
            ├── TransactionList.jsx
            ├── UploadStatement.jsx
            └── AnalyticsCharts.jsx

Требования к данным (Модели)

Основной источник данных — банковская выписка в формате CSV.
Заголовки исходного файла: Тип, Продукт, Дата начала, Дата выполнения, Описание, Сумма, Комиссия, Валюта, State, Остаток средств.

Модель Transaction (PostgreSQL):

    id: UUID или Integer (Primary Key)

    execution_date: DateTime (из колонки "Дата выполнения")

    description: String (из колонки "Описание", например "Smart Discount Shops")

    amount: Numeric/Decimal (из колонки "Сумма")

    currency: String (из колонки "Валюта")

    balance: Numeric/Decimal (из колонки "Остаток средств")

    category_id: Foreign Key (связь с таблицей Category)

    original_hash: String (Уникальный хеш строки для предотвращения дублирования при повторном импорте пересекающихся выписок)

Модель Category (PostgreSQL):

    id: Integer (Primary Key)

    name: String (Например: "Супермаркеты", "Кафе/Пекарни", "Транспорт")

Пошаговый план реализации (для ИИ-агента)
Шаг 1: Инфраструктура и База данных

    Создать docker-compose.yml с сервисами: postgres, backend, frontend.

    Настроить backend/database.py для подключения к PostgreSQL через SQLAlchemy.

    Описать модели Transaction и Category в models.py.

    Настроить Alembic и создать начальную миграцию.

Шаг 2: Бэкенд - Модуль импорта

    Создать API-эндпоинт (POST /api/import) для загрузки .csv файлов.

    Реализовать логику в import_service.py:

        Чтение CSV с учетом кодировки (обычно utf-8 или windows-1251).

        Парсинг дат (формат YYYY-MM-DD HH:MM:SS).

        Сохранение транзакций в БД.

        Важно: Реализовать идемпотентность (пропускать транзакции, которые уже есть в базе, сверяя их по дате, сумме и описанию).

Шаг 3: Бэкенд - API транзакций и аналитики

    Реализовать CRUD для транзакций (GET /api/transactions с пагинацией).

    Создать эндпоинт GET /api/analytics/summary, возвращающий агрегированные данные для графиков:

        Траты по месяцам.

        Траты по категориям.

        Динамика остатка средств (balance).

Шаг 4: Фронтенд - Базовый UI

    Настроить React + Vite приложение (frontend/).

    Создать страницу загрузки выписки (Drag & Drop или простой input file).

    Создать компонент таблицы для отображения истории транзакций с возможностью фильтрации по дате и тексту.

Шаг 5: Фронтенд - Дашборд аналитики

    Установить библиотеку для построения графиков (например, Recharts).

    Интегрировать данные из /api/analytics/summary.

    Отрисовать круговую диаграмму расходов и линейный график изменения баланса, чтобы обеспечить наглядный и глубокий анализ финансовых потоков.

Шаг 6: Категоризация (Продвинутая фича)

    Добавить UI для ручного назначения категорий транзакциям.

    (Опционально) Написать простую rule-based систему на бэкенде, которая при импорте ищет ключевые слова в description (например, "Bakery", "Supermarket") и автоматически присваивает нужную category_id.