import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export interface FileData {
  id: string;
  name: string;
  columns: string[];
  preview: Record<string, any>[];
  data: Record<string, any>[];
  statistics?: {
    numeric: Record<string, any>;
    categorical: Record<string, any>;
    correlations?: Array<{
      column1: string;
      column2: string;
      correlation: number;
    }>;
    trends?: Array<{
      column: string;
      trend_strength: number;
    }>;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface OperationForm {
  id: string;
  type: string;
  config: Record<string, any>;
  order: number;
}

export interface VisualizationConfig {
  id: string;
  type: string;
  title: string;
  description?: string;
  config: Record<string, any>;
  order: number;
}

export interface OperationPreview {
  columns: string[];
  data: any[];
}

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    throw error;
  }
);

const api = {
  // File Operations
  uploadFile: async (file: File): Promise<ApiResponse<FileData>> => {
    try {
      // Validate file before upload
      if (!file) {
        throw new Error('No file selected');
      }

      // Check file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        throw new Error('File size exceeds 10MB limit');
      }

      // Check file type
      const validTypes = [
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a CSV or Excel file');
      }

      console.log('Uploading file:', {
        name: file.name,
        type: file.type,
        size: file.size
      });

      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axiosInstance.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Upload response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error uploading file:', {
        error,
        response: error.response?.data,
        status: error.response?.status
      });

      // Handle specific error cases
      if (error.response?.status === 400) {
        throw new Error(error.response.data.detail || 'Invalid file format or content');
      } else if (error.response?.status === 413) {
        throw new Error('File is too large');
      } else if (error.message) {
        throw error;
      } else {
        throw new Error('Failed to upload file. Please try again.');
      }
    }
  },

  getFileData: async (fileId: string): Promise<ApiResponse<FileData>> => {
    try {
      const response = await axiosInstance.get(`/files/${fileId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting file data:', error);
      throw error;
    }
  },

  executeOperation: async (fileId: string, operation: { type: string; config: Record<string, any> }): Promise<ApiResponse<FileData>> => {
    try {
      const response = await axiosInstance.post(`/operations`, {
        fileId,
        ...operation,
        updateInPlace: true
      });
      return response.data;
    } catch (error) {
      console.error('Error executing operation:', error);
      throw error;
    }
  },

  getOperationPreview: async (fileId: string, operation: { type: string; config: Record<string, any> }): Promise<ApiResponse<OperationPreview>> => {
    try {
      const response = await axiosInstance.post(`/operations/preview`, {
        fileId,
        ...operation
      });
      return response.data;
    } catch (error) {
      console.error('Error getting operation preview:', error);
      throw error;
    }
  },

  createVisualization: async (fileId: string, visualization: VisualizationConfig): Promise<ApiResponse<any>> => {
    try {
      const response = await axiosInstance.post(`/visualizations`, {
        fileId,
        ...visualization
      });
      return response.data;
    } catch (error) {
      console.error('Error creating visualization:', error);
      throw error;
    }
  },

  getFormulaSuggestions: async (fileId: string, context: string): Promise<ApiResponse<string[]>> => {
    try {
      const response = await axiosInstance.post('/ai/suggestions', {
        fileId,
        context
      });
      return response.data;
    } catch (error) {
      console.error('Error getting formula suggestions:', error);
      throw error;
    }
  },

  exportFile: async (fileId: string, format: string, operations: OperationForm[] = []): Promise<Blob> => {
    try {
      const response = await axiosInstance.post('/export', {
        fileId,
        operations: operations.map(op => ({
          type: op.type,
          config: op.config
        })),
        visualizations: [],
        updateInPlace: true
      }, {
        responseType: 'blob',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting file:', error);
      throw error;
    }
  },

  generateAiSuggestions: async (data: {
    columns: {
      name: string;
      type: 'numeric' | 'categorical';
      metadata: {
        isNumeric: boolean;
        isCategorical: boolean;
        hasData: boolean;
      };
    }[];
  }): Promise<ApiResponse<any>> => {
    try {
      const response = await axiosInstance.post('/ai/suggestions', data);
      console.log("Testing API UI")
      console.log(response)
      return response.data;
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      throw error;
    }
  }
};

export default api; 