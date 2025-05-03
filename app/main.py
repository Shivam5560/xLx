from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
import pandas as pd
import os
from pathlib import Path
from celery import Celery
import redis
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Excel Automation Tool", version="1.0.0")

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis and Celery configuration
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=0
)

celery_app = Celery(
    'excel_automation',
    broker=f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', 6379)}/0",
    backend=f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', 6379)}/0"
)

# Create upload directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@app.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """
    Upload Excel/CSV files and return metadata
    """
    results = []
    for file in files:
        try:
            # Save file
            file_path = UPLOAD_DIR / file.filename
            with open(file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
            
            # Read file and get metadata
            if file.filename.endswith('.csv'):
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)
            
            metadata = {
                "filename": file.filename,
                "columns": df.columns.tolist(),
                "row_count": len(df),
                "column_count": len(df.columns),
                "sample_data": df.head().to_dict(orient='records')
            }
            results.append(metadata)
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing {file.filename}: {str(e)}")
    
    return JSONResponse(content={"files": results})

@app.get("/health")
async def health_check():
    return {"status": "healthy"} 