from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import pandas as pd
import numpy as np
import io
import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import os
from datetime import datetime
from groq import Groq
import re
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store files in memory (in production, use a proper storage solution)
files: Dict[str, pd.DataFrame] = {}

# Initialize Groq client with error handling
try:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("Warning: GROQ_API_KEY not found in environment variables")
        groq_client = None
    else:
        groq_client = Groq(api_key=api_key)
except Exception as e:
    print(f"Error initializing Groq client: {str(e)}")
    groq_client = None

class FileWorkflow:
    def __init__(self, file_id: str):
        self.file_id = file_id
        self.operations: List[Dict[str, Any]] = []
        self.current_state: Optional[pd.DataFrame] = None
    
    def add_operation(self, operation: Dict[str, Any]):
        self.operations.append(operation)
    
    def get_operations(self) -> List[Dict[str, Any]]:
        return self.operations
    
    def clear_operations(self):
        self.operations = []

# Store workflows for each file
file_workflows: Dict[str, FileWorkflow] = {}

class OperationRequest(BaseModel):
    fileId: str
    type: str
    config: Dict[str, Any]

class VisualizationConfig(BaseModel):
    type: str
    title: str
    config: Dict[str, Any]

class ExportRequest(BaseModel):
    fileId: str
    operations: List[Dict[str, Any]]
    visualizations: List[Dict[str, Any]]

def safe_float(value):
    """Convert a value to float, returning None if it's NaN or invalid"""
    try:
        if pd.isna(value) or np.isnan(value):
            return None
        return float(value)
    except (ValueError, TypeError):
        return None

def calculate_statistics(df: pd.DataFrame) -> dict:
    """Calculate comprehensive statistics for both numeric and categorical columns"""
    stats = {
        "numeric": {},
        "categorical": {}
    }
    
    # Process numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        try:
            # Handle NaN values in numeric columns
            col_data = df[col].replace([np.inf, -np.inf], np.nan)
            stats["numeric"][col] = {
                "min": safe_float(col_data.min()),
                "max": safe_float(col_data.max()),
                "mean": safe_float(col_data.mean()),
                "median": safe_float(col_data.median()),
                "mode": safe_float(col_data.mode().iloc[0]) if not col_data.mode().empty else None,
                "std": safe_float(col_data.std()),
                "percentiles": {
                    "25": safe_float(col_data.quantile(0.25)),
                    "50": safe_float(col_data.quantile(0.5)),
                    "75": safe_float(col_data.quantile(0.75))
                },
                "sum": safe_float(col_data.sum()),
                "count": int(col_data.count()),
                "missing": int(col_data.isna().sum()),
                "unique": int(col_data.nunique())
            }
        except Exception as e:
            print(f"Error processing numeric column {col}: {str(e)}")
            stats["numeric"][col] = {"error": "Could not process column"}
    
    # Process categorical columns
    cat_cols = df.select_dtypes(include=['object', 'category']).columns
    for col in cat_cols:
        try:
            # Handle NaN values in categorical columns
            col_data = df[col].fillna('Missing')
            value_counts = col_data.value_counts()
            unique_values = col_data.unique().tolist()
            stats["categorical"][col] = {
                "unique": unique_values,  # List of unique values
                "unique_count": int(col_data.nunique()),  # Count of unique values
                "frequency": {str(k): int(v) for k, v in value_counts.to_dict().items()},
                "top": str(value_counts.index[0]) if not value_counts.empty else None,
                "count": int(len(col_data)),
                "missing": int(col_data.isna().sum())
            }
        except Exception as e:
            print(f"Error processing categorical column {col}: {str(e)}")
            stats["categorical"][col] = {"error": "Could not process column"}
    
    return stats

@app.post("/api/files/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Read file content
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Determine file type
        file_ext = file.filename.split('.')[-1].lower()
        if file_ext not in ['xlsx', 'xls', 'csv']:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type: {file_ext}. Please upload a CSV or Excel file."
            )
        
        # Process file based on type
        try:
            if file_ext == 'csv':
                df = pd.read_csv(io.BytesIO(contents))
            else:  # Excel files
                df = pd.read_excel(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error reading file: {str(e)}. Please ensure the file is properly formatted."
            )
        
        # Validate DataFrame
        if df.empty:
            raise HTTPException(status_code=400, detail="File contains no data")
        
        # Calculate statistics
        stats = calculate_statistics(df)
        
        # Generate a unique file ID using timestamp
        file_id = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        
        # Store in memory (in production, you'd use a database)
        files[file_id] = df
        
        return {
            "success": True,
            "data": {
                "id": file_id,
                "name": file.filename,
                "columns": df.columns.tolist(),
                "preview": df.head(5).to_dict(orient='records'),
                "statistics": stats
            },
            "message": "File uploaded successfully"
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )
    finally:
        await file.close()

@app.post("/api/operations")
async def execute_operation(request: OperationRequest):
    try:
        print(f"Received operation request: {request}")  # Debug log
        print(f"Available files: {list(files.keys())}")  # Debug log
        
        if not request.fileId:
            raise HTTPException(status_code=400, detail="File ID is required")
            
        if request.fileId not in files:
            raise HTTPException(status_code=404, detail=f"File not found: {request.fileId}. Available files: {list(files.keys())}")
        
        # Get or create workflow for this file
        if request.fileId not in file_workflows:
            file_workflows[request.fileId] = FileWorkflow(request.fileId)
        
        workflow = file_workflows[request.fileId]
        
        # Add operation to workflow
        operation = {
            "type": request.type,
            "config": request.config,
            "timestamp": datetime.now().isoformat()
        }
        workflow.add_operation(operation)
        
        df = files[request.fileId]
        
        # Execute the operation
        if request.type == "Rename Column":
            old_column = request.config.get("oldColumn")
            new_column = request.config.get("newColumn")
            if not old_column or not new_column:
                raise HTTPException(status_code=400, detail="Both oldColumn and newColumn are required")
            if old_column not in df.columns:
                raise HTTPException(status_code=400, detail=f"Column not found: {old_column}. Available columns: {list(df.columns)}")
            df.rename(columns={old_column: new_column}, inplace=True)
        
        elif request.type == "Filter Data":
            column = request.config.get("column")
            condition = request.config.get("condition")
            value = request.config.get("value")
            if not all([column, condition, value]):
                raise HTTPException(status_code=400, detail="Column, condition, and value are required")
            if column not in df.columns:
                raise HTTPException(status_code=400, detail=f"Column not found: {column}")
            
            try:
                # Convert value to appropriate type based on column dtype
                if pd.api.types.is_numeric_dtype(df[column]):
                    value = float(value)
                
                if condition == "equals":
                    df.query(f"{column} == @value", inplace=True)
                elif condition == "contains":
                    df.query(f"{column}.astype(str).str.contains(@value, na=False)", inplace=True)
                elif condition == "greater_than":
                    df.query(f"{column} > @value", inplace=True)
                elif condition == "less_than":
                    df.query(f"{column} < @value", inplace=True)
                else:
                    raise HTTPException(status_code=400, detail=f"Invalid condition: {condition}")
            except ValueError as e:
                raise HTTPException(status_code=400, detail=f"Invalid value for comparison: {str(e)}")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Error applying filter: {str(e)}")
        
        elif request.type == "Sort Data":
            column = request.config.get("column")
            order = request.config.get("order")
            if not column or not order:
                raise HTTPException(status_code=400, detail="Column and order are required")
            if column not in df.columns:
                raise HTTPException(status_code=400, detail=f"Column not found: {column}")
            if order not in ["asc", "desc"]:
                raise HTTPException(status_code=400, detail="Order must be 'asc' or 'desc'")
            df.sort_values(by=column, ascending=(order == "asc"), inplace=True)
        
        elif request.type == "Apply Formula":
            target_column = request.config.get("targetColumn")
            formula = request.config.get("formula")
            if not target_column or not formula:
                raise HTTPException(status_code=400, detail="Target column and formula are required")
            try:
                df[target_column] = df.eval(formula)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid formula: {str(e)}")
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported operation type: {request.type}")
        
        print(f"Operation completed successfully on file: {request.fileId}")  # Debug log
        
        return {
            "success": True,
            "data": {
                "id": request.fileId,
                "name": request.fileId,
                "columns": df.columns.tolist(),
                "preview": df.head(5).to_dict(orient='records'),
                "operations": workflow.get_operations()
            }
        }
    except HTTPException as he:
        print(f"HTTP Exception in execute_operation: {str(he)}")
        raise he
    except Exception as e:
        print(f"Unexpected error in execute_operation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@app.post("/api/visualizations")
async def create_visualization(file_id: str, config: VisualizationConfig):
    try:
        if file_id not in files:
            raise HTTPException(status_code=404, detail="File not found")
        
        df = files[file_id]
        
        # Generate visualization data based on type
        if config.type == "Bar Chart":
            data = df[config.config["xAxis"]].value_counts().to_dict()
        elif config.type == "Line Chart":
            data = df.groupby(config.config["xAxis"])[config.config["yAxis"]].mean().to_dict()
        elif config.type == "Area Chart":
            data = df.groupby(config.config["xAxis"])[config.config["yAxis"]].mean().to_dict()
        elif config.type == "Radar Chart":
            data = df.groupby(config.config["xAxis"])[config.config["yAxis"]].mean().to_dict()
        elif config.type == "Radial Chart":
            data = df[config.config["xAxis"]].value_counts().to_dict()
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported chart type: {config.type}")
        
        return {
            "success": True,
            "data": {
                "type": config.type,
                "title": config.title,
                "data": data
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/export")
async def export_results(request: ExportRequest):
    try:
        if request.fileId not in files:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get the final processed data
        df = files[request.fileId]
        
        # Create Excel file in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # Write processed data
            df.to_excel(writer, sheet_name='Processed Data', index=False)
            
            # Write analysis
            analysis_df = generate_analysis_sheet(df)
            analysis_df.to_excel(writer, sheet_name='Analysis', index=False)
            
            # Write operations log
            operations_df = pd.DataFrame(request.operations)
            operations_df.to_excel(writer, sheet_name='Operations Log', index=False)
            
            # Write visualizations
            for viz in request.visualizations:
                viz_data = pd.DataFrame(viz['data'])
                viz_data.to_excel(writer, sheet_name=viz['title'][:31], index=False)
        
        output.seek(0)
        
        # Generate filename with original name
        original_name = request.fileId
        filename = f"modified_{original_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/files/{file_id}")
async def get_file_data(file_id: str):
    try:
        if file_id not in files:
            raise HTTPException(status_code=404, detail="File not found")
        
        df = files[file_id]
        
        return {
            "success": True,
            "data": {
                "id": file_id,
                "name": file_id,
                "columns": df.columns.tolist(),
                "preview": df.head(5).to_dict(orient='records')
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/files/{file_id}/workflow")
async def get_file_workflow(file_id: str):
    try:
        if file_id not in files:
            raise HTTPException(status_code=404, detail="File not found")
        
        if file_id not in file_workflows:
            file_workflows[file_id] = FileWorkflow(file_id)
        
        workflow = file_workflows[file_id]
        
        return {
            "success": True,
            "data": {
                "fileId": file_id,
                "operations": workflow.get_operations()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/files/{file_id}/workflow")
async def clear_file_workflow(file_id: str):
    try:
        if file_id not in files:
            raise HTTPException(status_code=404, detail="File not found")
        
        if file_id in file_workflows:
            file_workflows[file_id].clear_operations()
        
        return {
            "success": True,
            "message": "Workflow cleared successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/suggestions")
async def generate_ai_suggestions(data: dict):
    if not groq_client:
        raise HTTPException(
            status_code=503,
            detail="AI service is not available. Please check your GROQ_API_KEY configuration."
        )
    
    try:
        # print("Received metadata for AI suggestions:", json.dumps(data, indent=2))
        
        # Prepare data context with only metadata
        data_context = {
            "columns": data.get("columns", [])
        }

        # print("Prepared data context:", json.dumps(data_context, indent=2))

        # Prepare the prompt
        system_prompt = """You are a data visualization expert. Analyze the column metadata and suggest ALL possible visualizations.
        Return ONLY a JSON object with no additional text.
        
        Rules:
        1. Bar Charts: categorical X-axis, numeric Y-axis
        2. Line Charts: numeric X and Y axes
        3. Area Charts: numeric X and Y axes, good for showing cumulative values
        4. Radar Charts: multiple numeric variables for comparison
        5. Radial Charts: categorical with ≤8 values, good for showing proportions
        
        Format:
        {
          "suggestions": [
            {
              "type": "Bar Chart" | "Line Chart" | "Area Chart" | "Radar Chart" | "Radial Chart",
              "title": "string",
              "xAxis": "column_name",
              "yAxis": "column_name",
              "aggregation": "sum" | "mean" | "max" | "min" | "count" | "none",
              "insight": "string"
            }
          ]
        }"""

        user_prompt = f"Analyze this column metadata and suggest ALL possible visualizations: {json.dumps(data_context)}"

        print("Sending request to Groq API...")
        
        # Call Groq API
        completion = groq_client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": user_prompt
                }
            ],
            temperature=0.7,
            max_tokens=1024
        )

        print("Received response from Groq API")

        # Parse response
        content = completion.choices[0].message.content
        if not content:
            raise HTTPException(status_code=500, detail="No response from AI")

        # print("Raw AI response:", content)

        # Extract JSON from response
        try:
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                content = json_match.group(0)
            response = json.loads(content)
            print("Parsed JSON response:", json.dumps(response, indent=2))
        except Exception as e:
            print(f"Error parsing JSON response: {str(e)}")
            print("Failed content:", content)
            raise HTTPException(status_code=500, detail=f"Invalid JSON response from AI: {str(e)}")

        return {"success": True, "data": response}

    except Exception as e:
        print(f"Error in generate_ai_suggestions: {str(e)}")
        if hasattr(e, 'response'):
            print(f"Error response: {e.response}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 