'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import ReactFlow, { Controls, Background, Node, Edge, Connection, addEdge, getBezierPath, EdgeProps, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, Download, BarChart2, FileText, LineChart as LucideLineChart, PieChart as LucidePieChart, ScatterChart, ArrowRight, X, ChevronDown } from 'lucide-react';
import { VisualizationBuilder } from '@/components/VisualizationBuilder';
import { DataAnalysis } from '@/components/DataAnalysis';
import api, { ApiResponse, OperationForm, VisualizationConfig } from '@/lib/api';
import { toast } from 'sonner';
import { Groq } from 'groq-sdk';
import { AreaChart } from "@/components/visualizations/AreaChart";
import { BarChart } from "@/components/visualizations/BarChart";
import { LineChart } from "@/components/visualizations/LineChart";
import { RadarChart } from "@/components/visualizations/RadarChart";
import { RadialChart } from "@/components/visualizations/RadialChart";

// Initialize Groq client with API key check
const getGroqClient = () => {
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not set');
  }
  return new Groq({ 
    apiKey,
    dangerouslyAllowBrowser: true // Allow browser usage
  });
};

// Custom edge component for better arrows
const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <path
      id={id}
      style={style}
      className="react-flow__edge-path stroke-2 stroke-blue-500"
      d={edgePath}
      markerEnd={markerEnd}
    />
  );
};

const edgeTypes = {
  custom: CustomEdge,
};

interface FileInfo {
  file: File;
  data: FileData;
}

interface FileWorkflow {
  operations: OperationForm[];
  nodes: Node[];
  edges: Edge[];
}

// Add these interfaces after the existing interfaces
interface Correlation {
  column1: string;
  column2: string;
  correlation: number;
}

interface Trend {
  column: string;
  trend_strength: number;
}

interface Statistics {
  numeric: Record<string, any>;
  categorical: Record<string, any>;
  correlations?: Correlation[];
  trends?: Trend[];
}

// Update the FileData interface to include the new Statistics type
interface FileData {
  id: string;
  name: string;
  columns: string[];
  preview: Record<string, any>[];
  data: Record<string, any>[]; // Add complete data
  statistics?: Statistics;
}

// Add these interfaces at the top with other interfaces
interface SuggestionResponse {
  suggestions: Array<{
    type: 'Bar Chart' | 'Line Chart' | 'Area Chart' | 'Radar Chart' | 'Radial Chart';
    title: string;
    xAxis: string;
    yAxis: string;
    aggregation: 'sum' | 'mean' | 'max' | 'min' | 'count' | 'none';
    insight: string;
  }>;
}

// Add color palette constants at the top of the file after imports
const CHART_COLORS = {
  primary: '#2563eb', // Blue
  secondary: '#7c3aed', // Purple
  accent: '#db2777', // Pink
  success: '#059669', // Green
  warning: '#d97706', // Orange
  error: '#dc2626', // Red
  gray: '#6b7280', // Gray
  background: '#f3f4f6', // Light gray
  text: '#1f2937', // Dark gray
  grid: '#e5e7eb', // Lighter gray for grid
};

// Update the CHART_DIMENSIONS constant with adjusted padding for rotated y-axis title
const CHART_DIMENSIONS = {
  container: {
    width: 800,
    height: 500,
  },
  padding: {
    top: 60,     // Space for title and top margin
    right: 60,   // Space for y-axis labels and right margin
    bottom: 50,  // Space for x-axis labels and bottom margin
    left: 80,    // Increased for rotated y-axis title
  },
  bar: {
    minWidth: 30,
    maxWidth: 40,
    spacing: 40,
  },
  pie: {
    size: 280,
    legendSpacing: 20,
  },
  scatter: {
    pointRadius: 6,
    labelOffset: 15,
  },
};

// Add a function to generate a color palette for multiple items
const generateColorPalette = (count: number) => {
  const baseColors = [
    CHART_COLORS.primary,
    CHART_COLORS.secondary,
    CHART_COLORS.accent,
    CHART_COLORS.success,
    CHART_COLORS.warning,
    CHART_COLORS.error,
  ];
  
  return Array.from({ length: count }, (_, i) => {
    const baseColor = baseColors[i % baseColors.length];
    const hue = parseInt(baseColor.slice(1), 16);
    const lightness = 45 + (i * 5) % 20; // Vary lightness
    return `hsl(${hue}, 70%, ${lightness}%)`;
  });
};

// Update the API interface
interface GenerateAiSuggestionsRequest {
  columns: {
    name: string;
    type: 'numeric' | 'categorical';
    metadata: {
      isNumeric: boolean;
      isCategorical: boolean;
      hasData: boolean;
    };
  }[];
}

export default function Home() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [pendingOperations, setPendingOperations] = useState<OperationForm[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [visualizations, setVisualizations] = useState<VisualizationConfig[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [formulaSuggestions, setFormulaSuggestions] = useState<string[]>([]);
  const [pendingVisualizations, setPendingVisualizations] = useState<VisualizationConfig[]>([]);
  const [currentGraphType, setCurrentGraphType] = useState<string>('Bar Chart');
  const [operationSequence, setOperationSequence] = useState<{
    operations: OperationForm[];
    visualizations: VisualizationConfig[];
  }>({
    operations: [],
    visualizations: []
  });
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [tempOperationConfig, setTempOperationConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [showOperationForm, setShowOperationForm] = useState(false);
  const [operationType, setOperationType] = useState<string | null>(null);
  const [operationConfig, setOperationConfig] = useState<Record<string, any> | null>(null);
  const [operationForms, setOperationForms] = useState<OperationForm[]>([]);
  const [visualizationForm, setVisualizationForm] = useState<OperationForm>({
    type: 'Visualization',
    config: {
      title: '',
      xAxis: '',
      yAxis: ''
    },
    order: 0,
    id: `viz-form-${Date.now()}`
  });
  
  const [showFlow, setShowFlow] = useState<boolean>(false);
  const [selectedOperationType, setSelectedOperationType] = useState<string | null>(null);
  const [showOperationDialog, setShowOperationDialog] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<{
    type: string;
    config: Record<string, any>;
  } | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [currentFileData, setCurrentFileData] = useState<FileData | null>(null);

  // Add new state for storing workflows per file
  const [fileWorkflows, setFileWorkflows] = useState<Record<string, FileWorkflow>>({});

  // Add new state for processed files
  const [processedFiles, setProcessedFiles] = useState<FileData[]>([]);

  const [pendingUploads, setPendingUploads] = useState<File[]>([]);
  const [isUploadComplete, setIsUploadComplete] = useState(false);

  // Add new state variables after the existing state declarations
  const [aiSuggestions, setAiSuggestions] = useState<VisualizationConfig[]>([]);
  const [selectedAggregation, setSelectedAggregation] = useState<string>('sum');

  // Add new state for suggestion dialog
  const [showSuggestionDialog, setShowSuggestionDialog] = useState(false);
  const [generatedSuggestions, setGeneratedSuggestions] = useState<VisualizationConfig[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<VisualizationConfig | null>(null);

  // Add loading state for suggestions
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  // Add new state for saved suggestions after other state declarations
  const [savedSuggestions, setSavedSuggestions] = useState<VisualizationConfig[]>([]);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  // Add new state for storing suggestions per file
  const [fileSuggestions, setFileSuggestions] = useState<Record<string, VisualizationConfig[]>>({});

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setPendingUploads(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: true
  });

  const handleUploadAll = async () => {
    if (pendingUploads.length === 0) return;

    try {
      setLoading(true);
      const uploadedFiles: FileInfo[] = [];

      for (const file of pendingUploads) {
        const response = await api.uploadFile(file);
        if (response.success && response.data) {
          uploadedFiles.push({
            file,
            data: response.data
          });
        } else {
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      if (uploadedFiles.length > 0) {
        setFiles(uploadedFiles);
        setFileData(uploadedFiles[0].data);
        setSelectedFile(uploadedFiles[0].data);
        setIsUploadComplete(true);
        setPendingUploads([]);
        toast.success('All files uploaded successfully');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Error uploading files');
    } finally {
      setLoading(false);
    }
  };

  const updateColumnMapping = (oldName: string, newName: string) => {
    setColumnMappings(prev => ({
      ...prev,
      [oldName]: newName
    }));
  };

  const getCurrentColumnName = (column: string) => {
    return columnMappings[column] || column;
  };

  const getAvailableColumns = () => {
    if (!selectedFile) return [];
    return selectedFile.columns.map(col => ({
      original: col,
      current: getCurrentColumnName(col)
    }));
  };

  const handleOperationButtonClick = (type: string) => {
    setCurrentOperation({
      type,
      config: {}
    });
    setShowOperationDialog(true);
  };

  const addOperationNode = (type: string) => {
    setSelectedOperation(type);
    setOperationConfig({});
  };

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge(params, eds));
  }, []);

  const handleAddToFlow = () => {
    if (!selectedOperationType || !operationConfig) return;
    
    const newOperation: OperationForm = {
      id: `op-${Date.now()}`,
      type: selectedOperationType,
      config: operationConfig,
      order: operationForms.length
    };
    
    setOperationForms(prev => [...prev, newOperation]);
    setShowFlow(true);
    
    // Add to React Flow
    const newNode: Node = {
      id: newOperation.id,
      type: 'default',
      position: { x: 100, y: 100 + nodes.length * 100 },
      data: { 
        label: selectedOperationType,
        onEdit: () => handleEditOperation(newOperation.id),
        onDelete: () => handleDeleteOperation(newOperation.id)
      },
      style: {
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '10px',
        width: 200,
      }
    };
    setNodes(prev => [...prev, newNode]);
  };

  const handleEditOperation = (operationId: string) => {
    const operation = pendingOperations.find(op => op.id === operationId);
    if (operation) {
      setOperationType(operation.type);
      setOperationConfig(operation.config);
    }
  };

  const handleDeleteOperation = (operationId: string) => {
    const newOperations = operationForms.filter(op => op.id !== operationId);
    const newNodes = nodes.filter(node => node.id !== operationId);
    const newEdges = edges.filter(edge => 
      edge.source !== operationId && edge.target !== operationId
    );

    setOperationForms(newOperations);
    setNodes(newNodes);
    setEdges(newEdges);

    // Save the updated workflow
    if (selectedFile) {
      setFileWorkflows(prev => ({
        ...prev,
        [selectedFile.id]: {
          operations: newOperations,
          nodes: newNodes,
          edges: newEdges
        }
      }));
    }
  };

  const handleFormulaInput = async (value: string) => {
    if (!selectedFile || value.length < 3) {
      setFormulaSuggestions([]);
      return;
    }

    try {
      const response = await api.getFormulaSuggestions(selectedFile.id, value);
      if (response.success && response.data) {
        setFormulaSuggestions(response.data);
      }
    } catch (error) {
      console.error('Error getting formula suggestions:', error);
    }
  };

  const handleCreateVisualization = (config: Omit<VisualizationConfig, 'id' | 'order'>) => {
    const newVisualization: VisualizationConfig = {
      id: `viz-${Date.now()}`,
      ...config,
      order: visualizations.length + 1
    };

    setVisualizations(prev => [...prev, newVisualization]);
    setPendingVisualizations(prev => [...prev, newVisualization]);

    // Add to React Flow
    const newNode: Node = {
      id: newVisualization.id,
      type: 'default',
      position: { x: 100, y: 100 + nodes.length * 100 },
      data: { 
        label: newVisualization.title,
        onEdit: () => handleEditVisualization(newVisualization.id),
        onDelete: () => handleDeleteVisualization(newVisualization.id)
      },
      style: {
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '10px',
        width: 200,
      }
    };
    setNodes(prev => [...prev, newNode]);
  };

  const handleEditVisualization = (visualizationId: string) => {
    const visualization = visualizations.find(viz => viz.id === visualizationId);
    if (visualization) {
      setCurrentGraphType(visualization.type);
      // Set other visualization config state as needed
    }
  };

  const handleDeleteVisualization = (visualizationId: string) => {
    setVisualizations(prev => prev.filter(viz => viz.id !== visualizationId));
    setPendingVisualizations(prev => prev.filter(viz => viz.id !== visualizationId));
    setNodes(prev => prev.filter(node => node.id !== visualizationId));
  };

  const handleAddVisualizationToFlow = (form: OperationForm) => {
    if (!selectedFile) return;

    // Use the complete data if available, otherwise fallback to preview
    const completeData = selectedFile.data && selectedFile.data.length > 0 ? selectedFile.data : selectedFile.preview || [];
    if (!completeData || completeData.length === 0) return;

    // Normalize x-axis values for grouping
    const xAxis = form.config.xAxis;
    const yAxis = form.config.yAxis;
    const aggregation = selectedAggregation;
    const normalizedData = completeData.map(row => {
      const xValue = String(row[xAxis]).trim().toLowerCase();
      return {
        ...row,
        [xAxis]: xValue
      };
    });

    // Group by x-axis
    const groupedMap = new Map<string, typeof completeData[0][]>()
    normalizedData.forEach(row => {
      const xValue = row[xAxis] as string;
      if (!groupedMap.has(xValue)) groupedMap.set(xValue, []);
      groupedMap.get(xValue)?.push(row);
    });

    // Aggregate y-axis values
    const processedData = Array.from(groupedMap.entries()).map(([xValue, rows]) => {
      const yValues = rows
        .map(row => {
          const value = row[yAxis];
          return typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : 0;
        })
        .filter(val => !isNaN(val));
      let aggregatedValue = 0;
      switch (aggregation) {
        case 'sum':
          aggregatedValue = yValues.reduce((sum, val) => sum + val, 0);
          break;
        case 'mean':
          aggregatedValue = yValues.length > 0 ? yValues.reduce((sum, val) => sum + val, 0) / yValues.length : 0;
          break;
        case 'max':
          aggregatedValue = yValues.length > 0 ? Math.max(...yValues) : 0;
          break;
        case 'min':
          aggregatedValue = yValues.length > 0 ? Math.min(...yValues) : 0;
          break;
        case 'count':
          aggregatedValue = yValues.length;
          break;
        default:
          aggregatedValue = yValues.reduce((sum, val) => sum + val, 0);
      }
      // Use the original case for display
      const originalXValue = rows[0][xAxis];
      return {
        name: originalXValue,
        value: aggregatedValue,
        count: yValues.length,
        totalRows: rows.length,
        [xAxis]: originalXValue,
        [yAxis]: aggregatedValue
      };
    });

    // Sort processed data by x-axis value
    processedData.sort((a, b) => {
      const aValue = a.name;
      const bValue = b.name;
      const aNum = Number(aValue);
      const bNum = Number(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return String(aValue).localeCompare(String(bValue));
    });

    const newVisualization: VisualizationConfig = {
      id: `viz-${Date.now()}`,
      type: currentGraphType,
      title: form.config.title,
      config: {
        xAxis,
        yAxis,
        aggregation,
        data: processedData,
        showAllData: true,
        groupBy: xAxis,
        totalRows: completeData.length,
        groupedRows: processedData.length
      },
      order: visualizations.length
    };

    setVisualizations(prev => [...prev, newVisualization]);
    setPendingVisualizations(prev => [...prev, newVisualization]);

    // Add node to flow
    const newNode: Node = {
      id: newVisualization.id,
      type: 'visualization',
      position: { x: 250, y: visualizations.length * 100 },
      data: {
        label: newVisualization.title,
        type: newVisualization.type,
        config: newVisualization.config,
        onEdit: () => handleEditVisualization(newVisualization.id),
        onDelete: () => handleDeleteVisualization(newVisualization.id)
      }
    };

    setNodes(prev => [...prev, newNode]);
    setShowFlow(true);
  };

  const handleOperation = (operationType: string, config: Record<string, any>) => {
    setTempOperationConfig(config);
  };

  const handleApplyAll = async () => {
    if (!selectedFile) return;

    try {
      setLoading(true);
      const sortedOperations = [...operationForms].sort((a, b) => a.order - b.order);
      const processedFilesList: FileData[] = [];

      // Group operations by file
      const operationsByFile = sortedOperations.reduce((acc, operation) => {
        const fileId = operation.config.fileId;
        if (!acc[fileId]) {
          acc[fileId] = [];
        }
        acc[fileId].push(operation);
        return acc;
      }, {} as Record<string, OperationForm[]>);

      // Execute operations for each file
      for (const [fileId, operations] of Object.entries(operationsByFile)) {
        // Get the file data
        const fileData = files.find(f => f.data.id === fileId)?.data;
        if (!fileData) continue;

        // Execute operations sequentially on the file
        for (const operation of operations) {
          const result = await api.executeOperation(fileId, {
            type: operation.type,
            config: operation.config
          });
          
          if (!result.success) {
            throw new Error(`Operation ${operation.type} failed: ${result.error}`);
          }

          // Update column mappings if it's a rename operation
          if (operation.type === 'Rename Column') {
            updateColumnMapping(
              operation.config.oldColumn,
              operation.config.newColumn
            );
          }
        }

        // Get updated file data
        const newFileData = await api.getFileData(fileId);
        if (newFileData.success && newFileData.data) {
          // Add to processed files list
          processedFilesList.push(newFileData.data);
        }
      }

      // Set processed files and show download dialog
      setProcessedFiles(processedFilesList);
      setShowDownloadDialog(true);
      
      // Clear all states after successful operations
      setFiles([]);
      setFileData(null);
      setSelectedFile(null);
      setOperationForms([]);
      setNodes([]);
      setEdges([]);
      setFileWorkflows({});
      setIsUploadComplete(false);
      
      toast.success('All operations applied successfully');
    } catch (error) {
      console.error('Error applying operations:', error);
      toast.error('Error applying operations');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (fileId: string, format: string) => {
    try {
      const blob = await api.exportFile(fileId, format, []);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const file = files.find(f => f.data.id === fileId);
      a.download = `modified_${file?.data.name || 'export'}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`File ${file?.data.name} exported successfully`);
    } catch (error) {
      console.error('Error exporting file:', error);
      toast.error('Error exporting file');
    }
  };

  const renderFilePreview = () => {
    if (!fileData || !fileData.columns || !fileData.preview) {
      return null;
    }

    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">File Preview</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {fileData.columns.map((column: string, index: number) => (
                  <th
                    key={index}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {fileData.preview.map((row: Record<string, any>, rowIndex: number) => (
                <tr key={rowIndex}>
                  {fileData.columns.map((column: string, colIndex: number) => (
                    <td
                      key={colIndex}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                    >
                      {row[column]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderFileSelector = () => {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Select File for Operations</h3>
          <Select
            value={selectedFile?.id}
            onValueChange={handleFileSelection}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a file" />
            </SelectTrigger>
            <SelectContent>
              {files.map(({ data }) => (
                <SelectItem key={data.id} value={data.id}>
                  {data.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>
    );
  };

  const renderOperationDialog = () => {
    if (!currentOperation) return null;

    return (
      <div className="space-y-4">
        {selectedFile && (
          <>
            {currentOperation.type === 'Rename Column' && (
              <div className="space-y-4">
                <div>
                  <Label>Select Column</Label>
                  <Select
                    onValueChange={(value) => setCurrentOperation(prev => ({
                      ...prev!,
                      config: { ...prev!.config, oldColumn: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a column" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableColumns().map(({ original, current }) => (
                        <SelectItem key={original} value={original}>
                          {current}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>New Column Name</Label>
                  <Input
                    placeholder="Enter new column name"
                    onChange={(e) => setCurrentOperation(prev => ({
                      ...prev!,
                      config: { ...prev!.config, newColumn: e.target.value }
                    }))}
                  />
                </div>
              </div>
            )}

            {currentOperation.type === 'Filter Data' && (
              <div className="space-y-4">
                <div>
                  <Label>Select Column</Label>
                  <Select
                    onValueChange={(value) => setCurrentOperation(prev => ({
                      ...prev!,
                      config: { ...prev!.config, column: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a column" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableColumns().map(({ original, current }) => (
                        <SelectItem key={original} value={original}>
                          {current}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Filter Condition</Label>
                  <Select
                    onValueChange={(value) => setCurrentOperation(prev => ({
                      ...prev!,
                      config: { ...prev!.config, condition: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="greater_than">Greater Than</SelectItem>
                      <SelectItem value="less_than">Less Than</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Value</Label>
                  <Input
                    placeholder="Enter filter value"
                    onChange={(e) => setCurrentOperation(prev => ({
                      ...prev!,
                      config: { ...prev!.config, value: e.target.value }
                    }))}
                  />
                </div>
              </div>
            )}

            {currentOperation.type === 'Sort Data' && (
              <div className="space-y-4">
                <div>
                  <Label>Select Column</Label>
                  <Select
                    onValueChange={(value) => setCurrentOperation(prev => ({
                      ...prev!,
                      config: { ...prev!.config, column: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a column" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableColumns().map(({ original, current }) => (
                        <SelectItem key={original} value={original}>
                          {current}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sort Order</Label>
                  <Select
                    onValueChange={(value) => setCurrentOperation(prev => ({
                      ...prev!,
                      config: { ...prev!.config, order: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {currentOperation.type === 'Apply Formula' && (
              <div className="space-y-4">
                <div>
                  <Label>Target Column</Label>
                  <Input
                    placeholder="Enter target column name"
                    onChange={(e) => setCurrentOperation(prev => ({
                      ...prev!,
                      config: { ...prev!.config, targetColumn: e.target.value }
                    }))}
                  />
                </div>
                <div>
                  <Label>Formula</Label>
                  <Input
                    placeholder="Enter formula (e.g., A + B)"
                    onChange={(e) => setCurrentOperation(prev => ({
                      ...prev!,
                      config: { ...prev!.config, formula: e.target.value }
                    }))}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const handleVisualizationFormChange = (field: string, value: string) => {
    setVisualizationForm((prev: OperationForm) => ({
      ...prev,
      config: {
        ...prev.config,
        [field]: value
      }
    }));
  };

  // Update the file selection handler to save and restore workflows
  const handleFileSelection = (fileId: string) => {
    const fileInfo = files.find(f => f.data.id === fileId);
    if (fileInfo) {
      // Save current workflow if there's a selected file
      if (selectedFile) {
        setFileWorkflows(prev => ({
          ...prev,
          [selectedFile.id]: {
            operations: operationForms,
            nodes: nodes,
            edges: edges
          }
        }));
      }

      // Restore workflow for the new file
      const savedWorkflow = fileWorkflows[fileId];
      setSelectedFile(fileInfo.data);
      setFileData(fileInfo.data);
      
      if (savedWorkflow) {
        setOperationForms(savedWorkflow.operations);
        setNodes(savedWorkflow.nodes);
        setEdges(savedWorkflow.edges);
        setShowFlow(savedWorkflow.operations.length > 0);
      } else {
        // Clear operations if no saved workflow exists
        setOperationForms([]);
        setNodes([]);
        setEdges([]);
        setShowFlow(false);
      }
    }
  };

  // Update the download dialog
  const renderDownloadDialog = () => {
    if (!showDownloadDialog) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h3 className="text-lg font-semibold mb-4">Download Results</h3>
          <p className="text-sm text-gray-500 mb-4">
            Your operations have been applied successfully. Select files to download:
          </p>
          <div className="space-y-4">
            {processedFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">{file.name}</span>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(file.id, 'xlsx')}
                  >
                    XLSX
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(file.id, 'csv')}
                  >
                    CSV
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowDownloadDialog(false);
                setProcessedFiles([]);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Update the upload tab content
  const renderUploadTab = () => (
    <Card className="p-6">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <div className="flex justify-center">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          {isDragActive ? (
            <p className="text-lg text-blue-500">Drop the files here ...</p>
          ) : (
            <>
              <p className="text-lg text-gray-600">Drag and drop Excel/CSV files here</p>
              <p className="text-sm text-gray-500">or click to select files</p>
            </>
          )}
        </div>
      </div>
      
      {pendingUploads.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Files to Upload</h3>
            <Button
              onClick={handleUploadAll}
              disabled={loading}
            >
              {loading ? 'Uploading...' : 'Upload All'}
            </Button>
          </div>
          <div className="space-y-2">
            {pendingUploads.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Uploaded Files</h3>
          <div className="space-y-4">
            {files.map((fileInfo) => (
              <Card key={fileInfo.file.name} className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-medium">{fileInfo.file.name}</h4>
                    <p className="text-sm text-gray-500">
                      {(fileInfo.file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(fileInfo.data);
                      setFileData(fileInfo.data);
                    }}
                  >
                    Select
                  </Button>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <h5 className="text-sm font-medium">Preview</h5>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {fileInfo.data.columns.map((column) => (
                            <th
                              key={column}
                              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {fileInfo.data.preview.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {fileInfo.data.columns.map((column) => (
                              <td
                                key={column}
                                className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap"
                              >
                                {row[column]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </Card>
  );

  // Update the visualization tab content
  const renderVisualizationTab = () => (
    <div className="space-y-6">
      {/* Top Section: File Info, Workflow, and Inputs */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Side: File Info */}
        <Card className="p-6 col-span-3">
          <h3 className="text-lg font-semibold mb-4">File Information</h3>
          {selectedFile && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium mb-2">File Details</h4>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Name: {selectedFile.name}</p>
                  <p>Rows: {selectedFile.data?.length || selectedFile.preview.length}</p>
                  <p>Columns: {selectedFile.columns.length}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Column Types</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {selectedFile.columns.map((column) => {
                    const firstValue = selectedFile.preview[0]?.[column];
                    const type = typeof firstValue === 'number' ? 'Numeric' : 'Categorical';
                    return (
                      <div key={column} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                        <span className="text-gray-600 truncate">{column}</span>
                        <span className={`px-2 py-1 rounded text-xs ml-2 flex-shrink-0 ${
                          type === 'Numeric' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Middle: Workflow */}
        <Card className="p-6 col-span-6">
          <h3 className="text-lg font-semibold mb-4">Visualization Flow</h3>
          <div className="h-[400px]">
            {showFlow ? (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onConnect={onConnect}
                fitView
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{
                  type: 'custom',
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: '#3b82f6',
                  },
                }}
              >
                <Background />
                <Controls />
              </ReactFlow>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500">Add visualizations to create a flow</p>
              </div>
            )}
          </div>
        </Card>

        {/* Right Side: Input Configuration */}
        <Card className="p-6 col-span-3">
          <h3 className="text-lg font-semibold mb-4">Create Visualization</h3>
          {selectedFile ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Graph Type</Label>
                <Select
                  value={currentGraphType}
                  onValueChange={setCurrentGraphType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select graph type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bar Chart">Bar Chart</SelectItem>
                    <SelectItem value="Line Chart">Line Chart</SelectItem>
                    <SelectItem value="Area Chart">Area Chart</SelectItem>
                    <SelectItem value="Radar Chart">Radar Chart</SelectItem>
                    <SelectItem value="Radial Chart">Radial Chart</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder="Enter visualization title"
                  value={visualizationForm.config.title}
                  onChange={(e) => handleVisualizationFormChange('title', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>X-Axis</Label>
                <Select
                  value={visualizationForm.config.xAxis}
                  onValueChange={(value) => handleVisualizationFormChange('xAxis', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select X-axis column" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedFile?.columns?.map(column => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Y-Axis</Label>
                <Select
                  value={visualizationForm.config.yAxis}
                  onValueChange={(value) => handleVisualizationFormChange('yAxis', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Y-axis column" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedFile?.columns?.map(column => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Aggregation</Label>
                <Select
                  value={selectedAggregation}
                  onValueChange={setSelectedAggregation}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select aggregation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum">Sum</SelectItem>
                    <SelectItem value="mean">Mean</SelectItem>
                    <SelectItem value="max">Max</SelectItem>
                    <SelectItem value="min">Min</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  if (visualizationForm.config.title && 
                      visualizationForm.config.xAxis && 
                      visualizationForm.config.yAxis) {
                    handleAddVisualizationToFlow(visualizationForm);
                    // Reset form
                    setVisualizationForm({
                      type: 'Visualization',
                      config: {
                        title: '',
                        xAxis: '',
                        yAxis: ''
                      },
                      order: 0,
                      id: `viz-form-${Date.now()}`
                    });
                  } else {
                    toast.error('Please fill in all required fields');
                  }
                }}
              >
                Add to Flow
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Please select a file to create visualizations</p>
          )}
        </Card>
      </div>

      {/* Bottom Section: Visualizations */}
      <div className="space-y-6">
        {/* AI Suggested Visualizations */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">AI Suggested Visualizations</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateAiSuggestions()}
              disabled={!selectedFile || isGeneratingSuggestions}
            >
              {isGeneratingSuggestions ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>Generating...</span>
                </div>
              ) : (
                'Generate Suggestions'
              )}
            </Button>
          </div>
          <div className="h-[300px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
            {isGeneratingSuggestions ? (
              <div className="text-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-500">Analyzing data and generating suggestions...</p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-500 mb-2">No AI suggestions yet</p>
                <p className="text-sm text-gray-400">
                  {selectedFile 
                    ? "Click 'Generate Suggestions' to see recommended visualizations"
                    : "Please select a file to generate suggestions"}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Generated Visualizations */}
        {visualizations.length > 0 && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Your Visualizations</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setVisualizations([]);
                  setNodes([]);
                  setEdges([]);
                  setShowFlow(false);
                }}
              >
                Clear All
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {visualizations.map((viz) => (
                <div key={viz.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  {renderVisualization(viz)}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Add the suggestion dialog */}
      {renderSuggestionDialog()}
    </div>
  );

  // Update the visualization rendering to include tooltips and better styling
  const renderVisualization = (viz: VisualizationConfig) => {
    const title = viz.title || 'Visualization';
    const description = viz.description || 'Data visualization';

    switch (viz.type) {
      case 'Area Chart':
        return (
          <AreaChart
            data={viz.config.data}
            xAxis={viz.config.xAxis}
            yAxis={viz.config.yAxis}
            title={title}
            description={description}
          />
        );
      case 'Bar Chart':
        return (
          <BarChart
            data={viz.config.data}
            xAxis="name"
            yAxis={viz.config.yAxis}
            title={title}
            description={description}
          />
        );
      case 'Line Chart':
        return (
          <LineChart
            data={viz.config.data}
            xAxis={viz.config.xAxis}
            yAxis={viz.config.yAxis}
            title={title}
            description={description}
          />
        );
      case 'Radar Chart':
        return (
          <RadarChart
            data={viz.config.data}
            xAxis={viz.config.xAxis}
            yAxis={viz.config.yAxis}
            title={title}
            description={description}
          />
        );
      case 'Radial Chart':
        return (
          <RadialChart
            data={viz.config.data}
            xAxis={viz.config.xAxis}
            yAxis={viz.config.yAxis}
            title={title}
            description={description}
            showLegend={true}
          />
        );
      default:
        return null;
    }
  };

  // Update the retry logic function with better 503 handling
  const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        console.log(`Attempt ${i + 1} failed:`, error);
        
        // Check if it's a 503 error
        const isServiceUnavailable = error?.response?.status === 503 || 
                                   error?.message?.includes('503') ||
                                   error?.message?.includes('Service Unavailable');
        
        if (isServiceUnavailable) {
          console.log('Service temporarily unavailable (503). Will retry...');
          // Show toast for 503 errors
          toast.error('Service temporarily unavailable. Retrying...', {
            duration: 2000
          });
        }
        
        if (i === maxRetries - 1) {
          if (isServiceUnavailable) {
            throw new Error('Service is currently experiencing high load. Please try again in a few minutes.');
          }
          throw error;
        }
        
        // Calculate wait time based on error response or exponential backoff
        let waitTime = Math.pow(2, i); // Default exponential backoff
        
        // Try to get retry-after from error response
        if (error?.response?.headers) {
          const retryAfter = error.response.headers.get('retry-after');
          if (retryAfter) {
            waitTime = parseInt(retryAfter, 10);
          }
        }
        
        // For 503 errors, use a longer base wait time
        if (isServiceUnavailable) {
          waitTime = Math.max(waitTime, 5); // Minimum 5 seconds for 503
        }
        
        console.log(`Waiting ${waitTime} seconds before retry (attempt ${i + 2}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
    }
  };

  // Update the generateAiSuggestions function to properly handle the complete dataset
  const generateAiSuggestions = useCallback(async () => {
    if (!selectedFile || !selectedFile.statistics) {
      console.log('No file selected or statistics missing');
      return;
    }

    // Check if we already have suggestions for this file
    if (fileSuggestions[selectedFile.id]) {
      setGeneratedSuggestions(fileSuggestions[selectedFile.id]);
      setShowSuggestionDialog(true);
      return;
    }

    try {
      setIsGeneratingSuggestions(true);
      
      // Get the complete data from the file
      const completeData = selectedFile.data || selectedFile.preview;
      if (!completeData || completeData.length === 0) {
        throw new Error('No data available for visualization');
      }

      // Only send column metadata without actual data values
      const dataContext: GenerateAiSuggestionsRequest = {
        columns: selectedFile.columns.map(col => ({
          name: col,
          type: selectedFile.statistics?.numeric[col] ? 'numeric' : 'categorical',
          metadata: {
            isNumeric: selectedFile.statistics?.numeric[col] !== undefined,
            isCategorical: selectedFile.statistics?.categorical[col] !== undefined,
            hasData: true
          }
        }))
      };

      const response = await api.generateAiSuggestions(dataContext);
      
      if (!response.success || !response.data) {
        throw new Error('Failed to get response from API');
      }

      const apiSuggestions = response.data.suggestions;
      
      if (!apiSuggestions || !Array.isArray(apiSuggestions)) {
        throw new Error('Invalid response format from API');
      }

      // Simplified validation - just check if the required fields exist
      const validSuggestions = apiSuggestions.filter(suggestion => {
        return suggestion.type && 
               suggestion.title && 
               suggestion.xAxis && 
               suggestion.yAxis && 
               suggestion.aggregation;
      });

      if (validSuggestions.length === 0) {
        throw new Error('No valid suggestions generated');
      }

      const visualizationConfigs: VisualizationConfig[] = validSuggestions.map((suggestion, index) => ({
        id: `ai-viz-${Date.now()}-${index}`,
        type: suggestion.type,
        title: suggestion.title,
        config: {
          xAxis: suggestion.xAxis,
          yAxis: suggestion.yAxis,
          aggregation: suggestion.aggregation,
          insight: suggestion.insight,
          data: completeData,
          showAllData: true,
          groupBy: suggestion.xAxis,
          totalRows: completeData.length
        },
        order: index
      }));

      // Store suggestions for this file
      setFileSuggestions(prev => ({
        ...prev,
        [selectedFile.id]: visualizationConfigs
      }));
      
      setGeneratedSuggestions(visualizationConfigs);
      setShowSuggestionDialog(true);
      toast.success('AI suggestions generated successfully');

    } catch (error: any) {
      console.error('Error generating AI suggestions:', error);
      toast.error(error.message || 'Failed to generate AI suggestions');
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }, [selectedFile, fileSuggestions]);

  // Add function to handle suggestion selection
  const handleSuggestionSelection = useCallback((suggestion: VisualizationConfig) => {
    if (!selectedFile) {
      toast.error('No file selected');
      return;
    }

    // Get the complete data from the file
    const completeData = selectedFile.data || selectedFile.preview;
    if (!completeData || completeData.length === 0) {
      toast.error('No data available for visualization');
      return;
    }

    // First, normalize the x-axis values to ensure consistent grouping
    const normalizedData = completeData.map(row => {
      const xValue = String(row[suggestion.config.xAxis as keyof typeof row]).trim().toLowerCase();
      return {
        ...row,
        [suggestion.config.xAxis]: xValue
      };
    });

    // Group data by x-axis values using a Map for better performance
    const groupedMap = new Map<string, typeof completeData[0][]>();
    normalizedData.forEach(row => {
      const xValue = row[suggestion.config.xAxis as keyof typeof row] as string;
      if (!groupedMap.has(xValue)) {
        groupedMap.set(xValue, []);
      }
      groupedMap.get(xValue)?.push(row);
    });

    // Convert Map to array and process each group
    const processedData = Array.from(groupedMap.entries()).map(([xValue, rows]) => {
      // For count aggregation, we don't need to process y-axis values
      if (suggestion.config.aggregation === 'count') {
        // Get the original text value from the first row
        const originalTextValue = rows[0][suggestion.config.xAxis as keyof typeof rows[0]];
        return {
          name: originalTextValue, // Use original text value for display
          value: rows.length, // Count as the value
          count: rows.length,
          totalRows: rows.length,
          [suggestion.config.xAxis]: originalTextValue, // Original text value for x-axis
          [suggestion.config.yAxis]: rows.length // Count for y-axis
        };
      }

      // For other aggregations, process y-axis values
      const yValues = rows
        .map(row => {
          const value = row[suggestion.config.yAxis as keyof typeof row];
          return typeof value === 'number' ? value : 
                 typeof value === 'string' ? parseFloat(value) : 0;
        })
        .filter(val => !isNaN(val));

      // Calculate aggregated value based on the selected method
      let aggregatedValue = 0;
      switch (suggestion.config.aggregation) {
        case 'sum':
          aggregatedValue = yValues.reduce((sum, val) => sum + val, 0);
          break;
        case 'mean':
          aggregatedValue = yValues.length > 0 
            ? yValues.reduce((sum, val) => sum + val, 0) / yValues.length 
            : 0;
          break;
        case 'max':
          aggregatedValue = yValues.length > 0 ? Math.max(...yValues) : 0;
          break;
        case 'min':
          aggregatedValue = yValues.length > 0 ? Math.min(...yValues) : 0;
          break;
        case 'none':
          aggregatedValue = yValues.reduce((sum, val) => sum + val, 0);
          break;
        default:
          aggregatedValue = yValues.reduce((sum, val) => sum + val, 0);
      }

      // Get the original case of the x-axis value from the first row
      const originalXValue = rows[0][suggestion.config.xAxis as keyof typeof rows[0]];

      return {
        name: originalXValue,
        value: aggregatedValue,
        count: yValues.length,
        totalRows: rows.length,
        [suggestion.config.xAxis]: originalXValue,
        [suggestion.config.yAxis]: aggregatedValue
      };
    });

    // Sort the processed data by x-axis values
    processedData.sort((a, b) => {
      const aValue = a.name;
      const bValue = b.name;
      
      // Try numeric comparison first
      const aNum = Number(aValue);
      const bNum = Number(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      
      // Fall back to string comparison
      return String(aValue).localeCompare(String(bValue));
    });

    // Create formatted visualization config
    const formattedSuggestion: VisualizationConfig = {
      ...suggestion,
      config: {
        ...suggestion.config,
        data: processedData,
        showAllData: true,
        groupBy: suggestion.config.xAxis,
        totalRows: completeData.length,
        groupedRows: processedData.length,
        metadata: {
          totalGroups: processedData.length,
          aggregationType: suggestion.config.aggregation,
          xAxisType: typeof completeData[0][suggestion.config.xAxis as keyof typeof completeData[0]],
          yAxisType: suggestion.config.aggregation === 'count' ? 'count' : 
                    typeof completeData[0][suggestion.config.yAxis as keyof typeof completeData[0]]
        }
      }
    };

    // Update state with new visualization
    setVisualizations(prev => [...prev, formattedSuggestion]);
    setPendingVisualizations(prev => [...prev, formattedSuggestion]);

    // Create new node for the visualization
    const newNode: Node = {
      id: `viz-${Date.now()}`,
      type: 'visualization',
      position: { x: 100, y: 100 },
      data: {
        label: formattedSuggestion.config.title,
        type: formattedSuggestion.type,
        config: formattedSuggestion.config,
        onEdit: () => handleEditVisualization(formattedSuggestion.id),
        onDelete: () => handleDeleteVisualization(formattedSuggestion.id)
      }
    };

    setNodes(prev => [...prev, newNode]);
    setShowSuggestionDialog(false);
  }, [selectedFile, setVisualizations, setPendingVisualizations, setNodes, handleEditVisualization, handleDeleteVisualization]);

  // Update the suggestion dialog to use collapsible format
  const renderSuggestionDialog = () => {
    if (!showSuggestionDialog) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">AI Suggested Visualizations</h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSuggestionDialog(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            {generatedSuggestions.map((viz) => (
              <div
                key={viz.id}
                className="border rounded-lg overflow-hidden"
              >
                <div
                  className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setExpandedSuggestion(expandedSuggestion === viz.id ? null : viz.id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">{viz.title}</h4>
                      <p className="text-sm text-gray-500">
                        Type: {viz.type}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSuggestionSelection(viz);
                        }}
                      >
                        Add to Flow
                      </Button>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          expandedSuggestion === viz.id ? 'transform rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>
                  
                  {expandedSuggestion === viz.id && (
                    <div className="mt-4 space-y-2 text-sm text-gray-600">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="font-medium">X-Axis</p>
                          <p>{viz.config.xAxis}</p>
                        </div>
                        <div>
                          <p className="font-medium">Y-Axis</p>
                          <p>{viz.config.yAxis}</p>
                        </div>
                      </div>
                      {viz.config.aggregation && viz.config.aggregation !== 'none' && (
                        <div>
                          <p className="font-medium">Aggregation</p>
                          <p>{viz.config.aggregation}</p>
                        </div>
                      )}
                      {viz.config.insight && (
                        <div className="mt-2">
                          <p className="font-medium">Insight</p>
                          <p className="text-blue-600 italic">{viz.config.insight}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Excel Automation Tool</h1>
          <div className="space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowAnalysis(!showAnalysis)}
              disabled={!isUploadComplete}
            >
              <FileText className="w-4 h-4 mr-2" />
              {showAnalysis ? 'Hide Analysis' : 'Show Analysis'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport(selectedFile?.id || '', 'xlsx')}
              disabled={!isUploadComplete}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">Upload Files</TabsTrigger>
            <TabsTrigger value="operations" disabled={!isUploadComplete}>Operations</TabsTrigger>
            <TabsTrigger value="visualize" disabled={!isUploadComplete}>Visualize</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            {renderUploadTab()}
          </TabsContent>
          
          <TabsContent value="operations">
            <div className="space-y-6">
              {renderFileSelector()}
              
              {selectedFile ? (
                <div className="grid grid-cols-3 gap-6">
                  <Card className="p-6 col-span-1">
                    <h3 className="text-lg font-semibold mb-4">Available Operations</h3>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleOperationButtonClick('Rename Column')}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Rename Column
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleOperationButtonClick('Filter Data')}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Filter Data
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleOperationButtonClick('Sort Data')}
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Sort Data
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleOperationButtonClick('Merge Tables')}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Merge Tables
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleOperationButtonClick('Pivot Table')}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Pivot Table
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleOperationButtonClick('Apply Formula')}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Apply Formula
                      </Button>
                    </div>
                    {operationForms.length > 0 && (
                      <div className="mt-4">
                        <Button 
                          className="w-full"
                          onClick={handleApplyAll}
                        >
                          Apply All Operations
                        </Button>
                      </div>
                    )}
                  </Card>
                  
                  <Card className="p-6 col-span-2">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Operation Flow for {selectedFile.name}</h3>
                      {operationForms.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setOperationForms([]);
                            setNodes([]);
                            setEdges([]);
                          }}
                        >
                          Clear Flow
                        </Button>
                      )}
                    </div>
                    <div className="h-[600px]">
                      {showFlow ? (
                        <ReactFlow
                          nodes={nodes}
                          edges={edges}
                          onConnect={onConnect}
                          fitView
                          edgeTypes={edgeTypes}
                          defaultEdgeOptions={{
                            type: 'custom',
                            markerEnd: {
                              type: MarkerType.ArrowClosed,
                              color: '#3b82f6',
                            },
                          }}
                        >
                          <Background />
                          <Controls />
                        </ReactFlow>
                      ) : (
                        <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                          <p className="text-gray-500">Add operations to create a flow</p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              ) : (
                <Card className="p-6">
                  <div className="text-center py-8">
                    <p className="text-gray-500">Please select a file to start creating operations</p>
                  </div>
                </Card>
              )}
            </div>

            {/* Operation Configuration Dialog */}
            {showOperationDialog && currentOperation && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">
                      Configure {currentOperation.type}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowOperationDialog(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {renderOperationDialog()}
                  <div className="flex justify-end space-x-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setShowOperationDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (currentOperation) {
                          const newOperation: OperationForm = {
                            id: `op-${Date.now()}`,
                            type: currentOperation.type,
                            config: {
                              ...currentOperation.config,
                              fileId: selectedFile?.id
                            },
                            order: operationForms.length
                          };
                          setOperationForms(prev => [...prev, newOperation]);
                          setShowFlow(true);
                          
                          // Add to React Flow
                          const newNode: Node = {
                            id: newOperation.id,
                            type: 'default',
                            position: { x: 100, y: 100 + nodes.length * 100 },
                            data: { 
                              label: currentOperation.type,
                              onEdit: () => handleEditOperation(newOperation.id),
                              onDelete: () => handleDeleteOperation(newOperation.id)
                            },
                            style: {
                              background: '#fff',
                              border: '1px solid #ddd',
                              borderRadius: '8px',
                              padding: '10px',
                              width: 200,
                            }
                          };
                          setNodes(prev => [...prev, newNode]);
                          setShowOperationDialog(false);
                        }
                      }}
                    >
                      Add to Flow
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="visualize">
            {renderVisualizationTab()}
          </TabsContent>

          {showAnalysis && selectedFile && (
            <div className="mt-6">
              <DataAnalysis
                statistics={selectedFile.statistics || {
                  numeric: {},
                  categorical: {}
                }}
              />
            </div>
          )}
        </Tabs>
      </div>

      {/* Replace the old download dialog with the new one */}
      {renderDownloadDialog()}
    </main>
  );
} 