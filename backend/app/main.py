from fastapi import FastAPI
from .database import Base, engine
from .models import *

app = FastAPI()

# Create tables
Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "Backend connected successfully!"}

# ✅ START UVICORN WHEN RUNNING `python -m app.main`
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
