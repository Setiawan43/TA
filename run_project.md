# Cara Menjalankan Project

## Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API: `http://127.0.0.1:8000`
Dokumentasi API: `http://127.0.0.1:8000/docs`

## Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://127.0.0.1:5173`

## Dataset Contoh
Gunakan file pada folder `dataset`.
