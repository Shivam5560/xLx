from celery import Celery
import pandas as pd
import os
from pathlib import Path
from typing import List, Dict, Any
import groq
from dotenv import load_dotenv

load_dotenv()

celery_app = Celery('excel_automation')
celery_app.conf.broker_url = f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', 6379)}/0"
celery_app.conf.result_backend = f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', 6379)}/0"

# Initialize Groq client
groq_client = groq.Client(api_key=os.getenv("GROQ_API_KEY"))

@celery_app.task
def process_excel_operation(file_path: str, operation: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process Excel operations based on the provided configuration
    """
    try:
        # Read the file
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
        
        # Process based on operation type
        result = None
        if operation['type'] == 'rename_column':
            df = rename_column(df, operation)
        elif operation['type'] == 'filter_data':
            df = filter_data(df, operation)
        elif operation['type'] == 'sort_data':
            df = sort_data(df, operation)
        elif operation['type'] == 'merge_tables':
            df = merge_tables(df, operation)
        elif operation['type'] == 'pivot_table':
            df = create_pivot_table(df, operation)
        elif operation['type'] == 'formula':
            df = apply_formula(df, operation)
        
        # Save the result
        output_path = Path("output") / f"processed_{Path(file_path).name}"
        output_path.parent.mkdir(exist_ok=True)
        
        if file_path.endswith('.csv'):
            df.to_csv(output_path, index=False)
        else:
            df.to_excel(output_path, index=False)
        
        return {
            "status": "success",
            "output_path": str(output_path),
            "metadata": {
                "row_count": len(df),
                "column_count": len(df.columns),
                "columns": df.columns.tolist()
            }
        }
    
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

@celery_app.task
def get_ai_suggestions(metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get AI suggestions for operations based on file metadata
    """
    try:
        # Prepare context for AI
        context = f"""
        File metadata:
        - Columns: {metadata['columns']}
        - Row count: {metadata['row_count']}
        - Column count: {metadata['column_count']}
        
        Suggest operations that would be useful for this dataset.
        """
        
        # Get suggestions from Groq
        response = groq_client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {"role": "system", "content": "You are an expert data analyst. Provide suggestions for data operations based on the metadata provided."},
                {"role": "user", "content": context}
            ],
            temperature=0.8,
            max_tokens=2048
        )
        
        return {
            "status": "success",
            "suggestions": response.choices[0].message.content
        }
    
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

# Helper functions for specific operations
def rename_column(df: pd.DataFrame, operation: Dict[str, Any]) -> pd.DataFrame:
    df = df.rename(columns={operation['old_name']: operation['new_name']})
    return df

def filter_data(df: pd.DataFrame, operation: Dict[str, Any]) -> pd.DataFrame:
    column = operation['column']
    condition = operation['condition']
    value = operation['value']
    
    if condition == 'equals':
        return df[df[column] == value]
    elif condition == 'greater_than':
        return df[df[column] > value]
    elif condition == 'less_than':
        return df[df[column] < value]
    elif condition == 'contains':
        return df[df[column].str.contains(value, na=False)]
    return df

def sort_data(df: pd.DataFrame, operation: Dict[str, Any]) -> pd.DataFrame:
    return df.sort_values(by=operation['columns'], ascending=operation.get('ascending', True))

def merge_tables(df: pd.DataFrame, operation: Dict[str, Any]) -> pd.DataFrame:
    other_df = pd.read_excel(operation['other_file']) if operation['other_file'].endswith('.xlsx') else pd.read_csv(operation['other_file'])
    return pd.merge(df, other_df, on=operation['key_columns'], how=operation.get('how', 'inner'))

def create_pivot_table(df: pd.DataFrame, operation: Dict[str, Any]) -> pd.DataFrame:
    return pd.pivot_table(
        df,
        values=operation['values'],
        index=operation['index'],
        columns=operation.get('columns'),
        aggfunc=operation.get('aggfunc', 'mean')
    )

def apply_formula(df: pd.DataFrame, operation: Dict[str, Any]) -> pd.DataFrame:
    df[operation['new_column']] = df.eval(operation['formula'])
    return df 