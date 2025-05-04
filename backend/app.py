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
    """Convert a value to float, returning 0 if it's NaN, inf, or invalid"""
    try:
        if pd.isna(value) or np.isnan(value) or np.isinf(value):
            return 0.0
        return float(value)
    except (ValueError, TypeError):
        return 0.0

def calculate_statistics(df: pd.DataFrame) -> dict:
    """Calculate comprehensive statistics for both numeric and categorical columns,
    dropping NaNs from calculations but recording their counts."""
    stats = {"numeric": {}, "categorical": {}}

    # ----- Numeric columns -----
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        col_orig = df[col]
        # replace infinities with NaN, then separate out non‐nan values
        col_clean = col_orig.replace([np.inf, -np.inf], np.nan)
        nonan = col_clean.dropna()

        stats["numeric"][col] = {
            "min":    safe_float(nonan.min()),
            "max":    safe_float(nonan.max()),
            "mean":   safe_float(nonan.mean()),
            "median": safe_float(nonan.median()),
            "mode":   safe_float(nonan.mode().iloc[0]) if not nonan.mode().empty else None,
            "std":    safe_float(nonan.std()),
            "percentiles": {
                "25": safe_float(nonan.quantile(0.25)),
                "50": safe_float(nonan.quantile(0.50)),
                "75": safe_float(nonan.quantile(0.75)),
            },
            "sum":     safe_float(nonan.sum()),
            "count":   int(len(nonan)),          # count of non‐missing entries
            "missing": int(col_clean.isna().sum()),
            "unique":  int(nonan.nunique())
        }

    # ----- Categorical columns -----
    cat_cols = df.select_dtypes(include=['object', 'category']).columns
    for col in cat_cols:
        col_orig = df[col]
        missing_count = int(col_orig.isna().sum())
        # treat missing as its own category
        filled = col_orig.fillna('Missing')
        vc = filled.value_counts()

        stats["categorical"][col] = {
            "unique":        filled.unique().tolist(),
            "unique_count":  int(filled.nunique()),
            "frequency":     {str(k): int(v) for k, v in vc.items()},
            "top":           str(vc.idxmax()) if not vc.empty else None,
            "count":         int(len(filled)),
            "missing":       missing_count
        }

    return stats

def generate_analysis_sheet(df: pd.DataFrame) -> pd.DataFrame:
    """Generate a comprehensive analysis sheet for the DataFrame"""
    analysis_data = []
    
    # Process numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        try:
            col_data = df[col].replace([np.inf, -np.inf], np.nan)
            analysis_data.append({
                'Column': col,
                'Type': 'Numeric',
                'Min': safe_float(col_data.min()),
                'Max': safe_float(col_data.max()),
                'Mean': safe_float(col_data.mean()),
                'Median': safe_float(col_data.median()),
                'Std Dev': safe_float(col_data.std()),
                'Count': int(col_data.count()),
                'Missing': int(col_data.isna().sum()),
                'Unique Values': int(col_data.nunique())
            })
        except Exception as e:
            print(f"Error analyzing numeric column {col}: {str(e)}")
    
    # Process categorical columns
    cat_cols = df.select_dtypes(include=['object', 'category']).columns
    for col in cat_cols:
        try:
            col_data = df[col].fillna('Missing')
            value_counts = col_data.value_counts()
            analysis_data.append({
                'Column': col,
                'Type': 'Categorical',
                'Unique Values': int(col_data.nunique()),
                'Most Common': str(value_counts.index[0]) if not value_counts.empty else None,
                'Count': int(len(col_data)),
                'Missing': int(col_data.isna().sum()),
                'Top Categories': ', '.join([f"{k}({v})" for k, v in value_counts.head(3).items()])
            })
        except Exception as e:
            print(f"Error analyzing categorical column {col}: {str(e)}")
    
    return pd.DataFrame(analysis_data)

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
                "data": df.to_dict(orient='records'),  # Include complete data
                "statistics": stats,
                "totalRows": len(df)  # Add total row count
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
        
        # Get the complete data
        x_column = config.config["xAxis"]
        y_column = config.config["yAxis"]
        aggregation = config.config.get("aggregation", "sum")
        
        # Group by x-axis and apply aggregation to y-axis
        if aggregation == "sum":
            grouped_data = df.groupby(x_column)[y_column].sum()
        elif aggregation == "mean":
            grouped_data = df.groupby(x_column)[y_column].mean()
        elif aggregation == "max":
            grouped_data = df.groupby(x_column)[y_column].max()
        elif aggregation == "min":
            grouped_data = df.groupby(x_column)[y_column].min()
        elif aggregation == "count":
            grouped_data = df.groupby(x_column)[y_column].count()
        else:
            grouped_data = df.groupby(x_column)[y_column].sum()  # Default to sum
        
        # Convert to dictionary format
        data = grouped_data.to_dict()
        
        return {
            "success": True,
            "data": {
                "type": config.type,
                "title": config.title,
                "data": data,
                "totalRows": len(df),
                "groupedRows": len(data)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/export")
async def export_results(request: ExportRequest):
    try:
        print(f"Starting export for file: {request.fileId}")  # Debug log
        
        if request.fileId not in files:
            print(f"File not found: {request.fileId}. Available files: {list(files.keys())}")  # Debug log
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get the final processed data
        df = files[request.fileId]
        print(f"Retrieved DataFrame with shape: {df.shape}")  # Debug log
        
        # Create Excel file in memory
        output = io.BytesIO()
        try:
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                print("Writing processed data sheet...")  # Debug log
                # Write processed data
                df.to_excel(writer, sheet_name='Processed Data', index=False)
                
                print("Generating analysis sheet...")  # Debug log
                # Write analysis
                analysis_df = generate_analysis_sheet(df)
                analysis_df.to_excel(writer, sheet_name='Analysis', index=False)
                
                print("Writing operations log...")  # Debug log
                # Write operations log
                if request.operations:
                    operations_df = pd.DataFrame(request.operations)
                    operations_df.to_excel(writer, sheet_name='Operations Log', index=False)
                
                print("Writing visualizations...")  # Debug log
                # Write visualizations
                if request.visualizations:
                    for viz in request.visualizations:
                        try:
                            viz_title = viz.get('title', 'Untitled')[:31]  # Excel sheet names limited to 31 chars
                            viz_data = pd.DataFrame(viz.get('data', {}))
                            if not viz_data.empty:
                                viz_data.to_excel(writer, sheet_name=viz_title, index=False)
                        except Exception as viz_error:
                            print(f"Error writing visualization {viz_title}: {str(viz_error)}")
                            continue
        except Exception as excel_error:
            print(f"Error creating Excel file: {str(excel_error)}")
            raise HTTPException(status_code=500, detail=f"Error creating Excel file: {str(excel_error)}")
        
        output.seek(0)
        
        # Generate filename with original name
        original_name = request.fileId
        filename = f"modified_{original_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        print(f"Export completed successfully. File: {filename}")  # Debug log
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException as he:
        print(f"HTTP Exception in export_results: {str(he)}")
        raise he
    except Exception as e:
        print(f"Unexpected error in export_results: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during export: {str(e)}")

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
        # Prepare data context with only metadata
        data_context = {
            "columns": data.get("columns", [])
        }

        prompt = """
        You are a data visualization expert. Analyze the provided column metadata and generate chart suggestions.

        Available columns and their types:
        {data_context}

        Generate exactly one JSON object with a "suggestions" array. Each suggestion must include:
        - type: One of "Bar Chart", "Line Chart", "Area Chart", "Radar Chart", or "Radial Chart"
        - title: A descriptive title
        - xAxis: Must be an exact column name from the metadata
        - yAxis: Must be an exact column name from the metadata or same as xAxis when using count aggregation
        - aggregation: One of "sum", "mean", "max", "min", "count", or "none"

        Rules:
        1. All column names must match exactly with those in the metadata
        2. For numeric columns, use "sum", "mean", "max", or "min" aggregation
        3. For categorical columns:
           - Use "count" aggregation to count occurrences
           - When using "count" aggregation, yAxis should be the same as xAxis
           - Example: For "Order Count by Ship Mode", xAxis="Ship Mode", yAxis="Ship Mode", aggregation="count"
        4. For date/time columns (even if marked as categorical):
           - Can be used as x-axis in Line/Area charts
           - Should be sorted chronologically
           - Can be used with any numeric y-axis
        5. Bar Chart: 
           - Use categorical x-axis and numeric y-axis, or 
           - Use categorical x-axis with count aggregation (yAxis same as xAxis)
        6. Line Chart: Use date/time or numeric x-axis with numeric y-axis
        7. Area Chart: Same as Line Chart, emphasizing volume/trend
        8. Radar Chart: Use categorical x-axis with multiple numeric y-axes
        9. Radial Chart: Use categorical x-axis with numeric y-axis

        Return only the JSON object with the "suggestions" array.
        Ensure you provide at least two valid distinct suggestions per applicable chart type, varying axes and aggregation where possible, and reference the column names exactly as defined in metadata.
        """

        # Call Groq API
        completion = groq_client.chat.completions.create(
            model="gemma2-9b-it",
            messages=[
                {
                    "role": "user",
                    "content": prompt.format(data_context=json.dumps(data_context, indent=2))
                }
            ],
            temperature=0.7,
            max_tokens=1024
        )

        # Parse response
        content = completion.choices[0].message.content
        if not content:
            raise HTTPException(status_code=500, detail="No response from AI")

        # Extract JSON from response
        try:
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                content = json_match.group(0)
            response = json.loads(content)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Invalid JSON response from AI: {str(e)}")
        
        return {"success": True, "data": response}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 