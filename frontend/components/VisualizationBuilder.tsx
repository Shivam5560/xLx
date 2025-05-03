import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VisualizationConfig } from '@/lib/api';

interface VisualizationBuilderProps {
  columns: string[];
  onCreate: (config: VisualizationConfig) => void;
}

const visualizationTypes = [
  { id: 'bar', name: 'Bar Chart', axes: 2 },
  { id: 'line', name: 'Line Chart', axes: 2 },
  { id: 'scatter', name: 'Scatter Plot', axes: 2 },
  { id: 'pie', name: 'Pie Chart', axes: 1 },
  { id: 'heatmap', name: 'Heatmap', axes: 2 },
  { id: 'box', name: 'Box Plot', axes: 2 },
  { id: 'histogram', name: 'Histogram', axes: 1 },
  { id: '3d-scatter', name: '3D Scatter Plot', axes: 3 },
];

export function VisualizationBuilder({ columns, onCreate }: VisualizationBuilderProps) {
  const [type, setType] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [xAxis, setXAxis] = useState<string>('');
  const [yAxis, setYAxis] = useState<string>('');
  const [zAxis, setZAxis] = useState<string>('');
  const [colorBy, setColorBy] = useState<string>('');
  const [sizeBy, setSizeBy] = useState<string>('');

  const selectedType = visualizationTypes.find(t => t.id === type);
  const numericColumns = columns.filter(col => col.match(/^[A-Z]+[0-9]+$/));

  const handleCreate = () => {
    const config: VisualizationConfig = {
      type,
      title,
      xAxis: selectedType?.axes >= 1 ? xAxis : undefined,
      yAxis: selectedType?.axes >= 2 ? yAxis : undefined,
      zAxis: selectedType?.axes >= 3 ? zAxis : undefined,
      colorBy: colorBy || undefined,
      sizeBy: sizeBy || undefined,
    };
    onCreate(config);
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Visualization Type</Label>
          <Select onValueChange={setType}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {visualizationTypes.map(type => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            placeholder="Enter visualization title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {selectedType && (
          <>
            {selectedType.axes >= 1 && (
              <div className="space-y-2">
                <Label>X Axis</Label>
                <Select onValueChange={setXAxis}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {numericColumns.map(column => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedType.axes >= 2 && (
              <div className="space-y-2">
                <Label>Y Axis</Label>
                <Select onValueChange={setYAxis}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {numericColumns.map(column => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedType.axes >= 3 && (
              <div className="space-y-2">
                <Label>Z Axis</Label>
                <Select onValueChange={setZAxis}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {numericColumns.map(column => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Color By (Optional)</Label>
              <Select onValueChange={setColorBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(column => (
                    <SelectItem key={column} value={column}>
                      {column}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Size By (Optional)</Label>
              <Select onValueChange={setSizeBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {numericColumns.map(column => (
                    <SelectItem key={column} value={column}>
                      {column}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <Button 
          className="w-full"
          onClick={handleCreate}
          disabled={!type || !title || (selectedType?.axes === 1 && !xAxis) || 
                   (selectedType?.axes === 2 && (!xAxis || !yAxis)) ||
                   (selectedType?.axes === 3 && (!xAxis || !yAxis || !zAxis))}
        >
          Create Visualization
        </Button>
      </div>
    </Card>
  );
} 