# Backend Specification & Implementation Guide

This document outlines the API requirements and implementation details for the LinguaLearn Chrome Extension backend service.

## 1. Technology Stack Recommendation

*   **Language:** Python 3.10+
*   **Framework:** **FastAPI** (Modern, fast, auto-generates Swagger/OpenAPI docs)
*   **Database:** SQLite (for local dev) or PostgreSQL (production)
*   **ORM:** SQLAlchemy or SQLModel
*   **Translation Service:** Integration with Google Cloud Translation API, DeepL API, or OpenAI API.

## 2. API Specifications

### Base URL
`http://localhost:8000` (Local)

### Endpoints

#### A. Translation

**POST** `/api/translate`

Translates text and provides phonetic info.

*   **Request Body:**
    ```json
    {
      "text": "Hello world",
      "source_lang": "auto",
      "target_lang": "zh"
    }
    ```

*   **Response:**
    ```json
    {
      "translation": "你好世界",
      "phonetic": "Nǐ hǎo shìjiè",
      "detected_source_lang": "en"
    }
    ```

#### B. Vocabulary Management

**GET** `/api/words`

Retrieve saved words.

*   **Query Params:**
    *   `limit`: (Optional) number of words.
    *   `skip`: (Optional) pagination offset.

*   **Response:**
    ```json
    [
      {
        "id": "uuid-string",
        "original": "apple",
        "translation": "苹果",
        "context": "I ate an apple.",
        "url": "https://example.com",
        "timestamp": 1675580000000,
        "learned": false
      }
    ]
    ```

**POST** `/api/words`

Save a new word.

*   **Request Body:**
    ```json
    {
      "original": "apple",
      "translation": "苹果",
      "context": "I ate an apple.",
      "url": "https://example.com"
    }
    ```
    *Note: Backend should generate `id`, `timestamp`, and default `learned`=false.*

*   **Response:** `201 Created` - Returns the created word object.

**DELETE** `/api/words/{word_id}`

Delete a word.

*   **Response:** `200 OK` or `204 No Content`.

**PATCH** `/api/words/{word_id}`

Update word status (e.g., mark as learned).

*   **Request Body:**
    ```json
    {
      "learned": true
    }
    ```

#### C. User Settings

**GET** `/api/settings`

*   **Response:**
    ```json
    {
      "target_language": "zh",
      "highlight_enabled": true,
      "immersion_mode": false
    }
    ```

**PUT** `/api/settings`

*   **Request Body:**
    ```json
    {
      "target_language": "es",
      "highlight_enabled": false
    }
    ```

---

## 3. Python Implementation (FastAPI Example)

Below is a complete starter code for `main.py` using FastAPI.

### Prerequisites
Create a `requirements.txt`:
```txt
fastapi
uvicorn
pydantic
sqlmodel
googletrans==4.0.0-rc1  # Or use an official API client
```

### `main.py`

```python
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Field, Session, create_engine, select
from pydantic import BaseModel
import time
from uuid import uuid4

# --- Database Setup ---
class Word(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    original: str
    translation: str
    context: Optional[str] = None
    url: Optional[str] = None
    timestamp: float = Field(default_factory=lambda: time.time() * 1000)
    learned: bool = False

class Settings(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    target_language: str = "zh"
    highlight_enabled: bool = True
    immersion_mode: bool = False

# SQLite database
sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
engine = create_engine(sqlite_url)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

# --- API Models ---
class TranslateRequest(BaseModel):
    text: str
    target_lang: str

class TranslateResponse(BaseModel):
    translation: str
    phonetic: Optional[str] = None

class WordCreate(BaseModel):
    original: str
    translation: str
    context: Optional[str] = None
    url: Optional[str] = None

class WordUpdate(BaseModel):
    learned: Optional[bool] = None

class SettingsUpdate(BaseModel):
    target_language: Optional[str] = None
    highlight_enabled: Optional[bool] = None
    immersion_mode: Optional[bool] = None

# --- App Definition ---
app = FastAPI(title="LinguaLearn Backend")

# Enable CORS for Chrome Extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to extension ID like "chrome-extension://<id>"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    # Initialize settings if not exists
    with Session(engine) as session:
        if not session.get(Settings, 1):
            session.add(Settings())
            session.commit()

# --- Routes ---

# 1. Translation Endpoint
# Note: For production, replace this with a real API key (Google Cloud / DeepL)
# This uses a library that might be unstable; use official APIs for best results.
@app.post("/api/translate", response_model=TranslateResponse)
def translate_text(request: TranslateRequest):
    # Mock implementation or use googletrans library
    # from googletrans import Translator
    # translator = Translator()
    # result = translator.translate(request.text, dest=request.target_lang)
    
    # Mocking for now to avoid external dep issues in this snippet:
    return {
        "translation": f"[Tran: {request.text}]", 
        "phonetic": "..."
    }

# 2. Vocabulary Endpoints
@app.get("/api/words", response_model=List[Word])
def get_words(session: Session = Depends(get_session)):
    statement = select(Word).order_by(Word.timestamp.desc())
    results = session.exec(statement).all()
    return results

@app.post("/api/words", response_model=Word)
def create_word(word_in: WordCreate, session: Session = Depends(get_session)):
    # Check duplicate
    statement = select(Word).where(Word.original == word_in.original)
    existing = session.exec(statement).first()
    if existing:
        return existing
        
    word = Word.from_orm(word_in)
    session.add(word)
    session.commit()
    session.refresh(word)
    return word

@app.delete("/api/words/{word_id}")
def delete_word(word_id: str, session: Session = Depends(get_session)):
    word = session.get(Word, word_id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    session.delete(word)
    session.commit()
    return {"ok": True}

# 3. Settings Endpoints
@app.get("/api/settings", response_model=Settings)
def get_settings(session: Session = Depends(get_session)):
    settings = session.get(Settings, 1)
    return settings

@app.put("/api/settings", response_model=Settings)
def update_settings(settings_in: SettingsUpdate, session: Session = Depends(get_session)):
    settings = session.get(Settings, 1)
    if not settings:
        settings = Settings()
    
    settings_data = settings_in.dict(exclude_unset=True)
    for key, value in settings_data.items():
        setattr(settings, key, value)
        
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

## 4. Next Steps

1.  **Set up the environment:**
    ```bash
    mkdir backend
    cd backend
    python -m venv venv
    source venv/bin/activate  # or venv\Scripts\activate on Windows
    pip install fastapi uvicorn sqlmodel
    ```

2.  **Create the files:**
    *   Save the code above into `main.py`.

3.  **Run the server:**
    ```bash
    python main.py
    ```

4.  **Update Chrome Extension:**
    *   Modify `utils.js` to fetch from `http://localhost:8000/api/translate` instead of the mock function.
    *   Modify `wordbook.js` and `background.js` to sync with the `/api/words` endpoints.
