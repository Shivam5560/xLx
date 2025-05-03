import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BarChart2, LineChart, PieChart as LucidePieChart, ScatterChart, TrendingUp, Activity } from 'lucide-react';

interface DataAnalysisProps {
  statistics: {
    numeric: {
      [key: string]: {
        min: number;
        max: number;
        mean: number;
        median: number;
        mode: number;
        std: number;
        percentiles: {
          '25': number;
          '50': number;
          '75': number;
        };
        sum: number;
      };
    };
    categorical: {
      [key: string]: {
        unique: number;
        frequency: { [key: string]: number };
        top: string[];
      };
    };
  };
}

interface VisualizationSuggestion {
  type: string;
  title: string;
  description: string;
  columns: string[];
  icon: React.ReactNode;
}

export function DataAnalysis({ statistics }: DataAnalysisProps) {
  const [suggestions, setSuggestions] = useState<VisualizationSuggestion[]>([]);

  useEffect(() => {
    // Generate visualization suggestions based on data metadata
    const generateSuggestions = () => {
      const newSuggestions: VisualizationSuggestion[] = [];
      const numericColumns = Object.keys(statistics.numeric);
      const categoricalColumns = Object.keys(statistics.categorical);

      // Time series analysis if we have numeric data
      if (numericColumns.length > 0) {
        newSuggestions.push({
          type: 'line',
          title: 'Trend Analysis',
          description: 'Visualize trends and patterns over time',
          columns: numericColumns.slice(0, 2),
          icon: <TrendingUp className="w-6 h-6" />
        });
      }

      // Distribution analysis for numeric columns
      if (numericColumns.length > 0) {
        newSuggestions.push({
          type: 'histogram',
          title: 'Distribution Analysis',
          description: 'Analyze the distribution of numeric values',
          columns: numericColumns,
          icon: <Activity className="w-6 h-6" />
        });
      }

      // Correlation analysis if we have multiple numeric columns
      if (numericColumns.length >= 2) {
        newSuggestions.push({
          type: 'scatter',
          title: 'Correlation Analysis',
          description: 'Explore relationships between numeric variables',
          columns: numericColumns.slice(0, 2),
          icon: <ScatterChart className="w-6 h-6" />
        });
      }

      // Categorical analysis
      if (categoricalColumns.length > 0) {
        newSuggestions.push({
          type: 'bar',
          title: 'Category Distribution',
          description: 'Compare frequencies across categories',
          columns: categoricalColumns,
          icon: <BarChart2 className="w-6 h-6" />
        });

        newSuggestions.push({
          type: 'pie',
          title: 'Category Proportions',
          description: 'View category proportions in the dataset',
          columns: categoricalColumns,
          icon: <LucidePieChart className="w-6 h-6" />
        });
      }

      // Mixed analysis (numeric vs categorical)
      if (numericColumns.length > 0 && categoricalColumns.length > 0) {
        newSuggestions.push({
          type: 'bar',
          title: 'Category Comparison',
          description: 'Compare numeric metrics across categories',
          columns: [...categoricalColumns.slice(0, 1), ...numericColumns.slice(0, 1)],
          icon: <BarChart2 className="w-6 h-6" />
        });
      }

      setSuggestions(newSuggestions);
    };

    generateSuggestions();
  }, [statistics]);

  return (
    <Card className="p-6">
      <Tabs defaultValue="numeric">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="numeric">Numeric Analysis</TabsTrigger>
          <TabsTrigger value="categorical">Categorical Analysis</TabsTrigger>
          <TabsTrigger value="visualizations">Visualization Suggestions</TabsTrigger>
        </TabsList>

        <TabsContent value="numeric">
          <div className="space-y-4">
            {Object.entries(statistics.numeric).map(([column, stats]) => (
              <Card key={column} className="p-4">
                <h3 className="text-lg font-semibold mb-2">{column}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Basic Statistics</p>
                    <ul className="space-y-1">
                      <li>Min: {stats.min.toFixed(2)}</li>
                      <li>Max: {stats.max.toFixed(2)}</li>
                      <li>Mean: {stats.mean.toFixed(2)}</li>
                      <li>Median: {stats.median.toFixed(2)}</li>
                      <li>Mode: {stats.mode.toFixed(2)}</li>
                      <li>Std Dev: {stats.std.toFixed(2)}</li>
                      <li>Sum: {stats.sum.toFixed(2)}</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Percentiles</p>
                    <ul className="space-y-1">
                      <li>25th: {stats.percentiles['25'].toFixed(2)}</li>
                      <li>50th: {stats.percentiles['50'].toFixed(2)}</li>
                      <li>75th: {stats.percentiles['75'].toFixed(2)}</li>
                    </ul>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="categorical">
          <div className="space-y-4">
            {Object.entries(statistics.categorical).map(([column, stats]) => (
              <Card key={column} className="p-4">
                <h3 className="text-lg font-semibold mb-2">{column}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Summary</p>
                    <ul className="space-y-1">
                      <li>Unique Values: {stats.unique}</li>
                      <li>Top Value: {stats.top}</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Frequency Distribution</p>
                    <div className="max-h-40 overflow-y-auto">
                      {Object.entries(stats.frequency).map(([value, count]) => (
                        <div key={value} className="flex justify-between text-sm">
                          <span>{value}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="visualizations">
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-4">
              Based on your data, here are some suggested visualizations that could provide valuable insights:
            </p>
            <div className="grid grid-cols-2 gap-4">
              {suggestions.map((suggestion, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {suggestion.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">{suggestion.title}</h3>
                      <p className="text-sm text-gray-500 mb-2">{suggestion.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestion.columns.map((col, i) => (
                          <span key={i} className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs">
                            {col}
                          </span>
                        ))}
                      </div>
                      <Button 
                        className="mt-3"
                        variant="outline"
                        onClick={() => {
                          // Handle visualization creation
                          console.log('Create visualization:', suggestion);
                        }}
                      >
                        Create Visualization
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
} 