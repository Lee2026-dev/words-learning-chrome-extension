# Backend Generation Prompt

You are an expert Python Backend Engineer specializing in **FastAPI**, **Supabase**, and modern Python tooling like **uv**.

Your task is to generate a complete, production-ready backend project for a Chrome Extension called "LinguaLearn".

## Project Goals
1. Provide a REST API for the Chrome Extension to translate text.
2. Store user vocabulary (Word Book) and settings in a **Supabase (PostgreSQL)** database.
3. Manage dependencies and project structure using **uv**.
4. Ensure the API is robust, typed (using Pydantic), and documented.

## Technology Stack
- **Framework**: FastAPI
- **Database**: Supabase (via SQLModel/SQLAlchemy using the PostgreSQL connection string)
- **Runtime**: Uvicorn
- **Package Manager**: uv
- **Language**: Python 3.10+
- **Configuration**: `python-dotenv` for environment variables

## Data Models (SQLModel)

### 1. Word (The vocabulary item)
- `id`: string (UUID), primary key
- `original`: string (The source text)
- `translation`: string (The translated text)
- `context`: string (Optional - the sentence where the word was found)
- `url`: string (Optional - source URL)
- `timestamp`: float (Creation time)
- `learned`: boolean (Status, default `False`)

### 2. Settings (User preferences)
- `id`: int (Primary key, singleton row usually ID=1)
- `target_language`: string (default "zh")
- `highlight_enabled`: boolean (default True)
- `immersion_mode`: boolean (default False)

## API Endpoints Specification

### Translation
- **POST** `/api/translate`
  - Input: `{ "text": "...", "target_lang": "zh" }`
  - Output: `{ "translation": "...", "phonetic": "...", "detected_source_lang": "en" }`
  - *Note*: Use `googletrans` library or a mock service for now.

### Vocabulary
- **GET** `/api/words`: Return list of saved words (sorted by newest).
- **POST** `/api/words`: Save a new word. Check for duplicates (by `original` field).
- **DELETE** `/api/words/{word_id}`: Delete a word.
- **PATCH** `/api/words/{word_id}`: Update word (e.g., set `learned = True`).

### Settings
- **GET** `/api/settings`: Return current settings. Initialize defaults if empty.
- **PUT** `/api/settings`: Update settings.

## Environment Variables
The application must read `DATABASE_URL` from a `.env` file.
Format: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

## Implementation Instructions for the AI
1. **Dependency Management**:
   - Provide the `uv` commands to initialize the project and add dependencies.
   - Dependencies: `fastapi`, `uvicorn`, `sqlmodel`, `psycopg2-binary`, `python-dotenv`, `requests`, `googletrans==4.0.0-rc1`.

2. **Database Connection**:
   - Create a `database.py` module.
   - Use `SQLModel` with `create_engine` using the `DATABASE_URL`.
   - Ensure the engine handles connection pooling correctly.

3. **Application Code (`main.py`)**:
   - Initialize tables in `@app.on_event("startup")` using `SQLModel.metadata.create_all(engine)`.
   - Configure CORS to allow `*` (or specifically Chrome Extensions).
   - Implement all API endpoints described above.

4. **Response Format**:
   - Don't just give me the code, give me the **Shell Commands** to set it up using `uv` first.
   - Then provide the Python code files.

Please generate the detailed instructions and code now.
