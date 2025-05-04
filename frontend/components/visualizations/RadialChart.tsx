"use client"

import * as React from "react"
import { Cell, Pie, PieChart as RechartsPieChart, ResponsiveContainer } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  CHART_COLORS,
} from "@/components/ui/chart"

interface RadialChartProps {
  data: Array<{
    name: string;
    value: number;
    [key: string]: any;
  }>;
  xAxis: string;
  yAxis: string;
  title: string;
  description?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  formatValue?: (value: number) => string;
  innerRadius?: number;
  outerRadius?: number;
}

const CHART_COLOR_ARRAY = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.accent,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.error,
  CHART_COLORS.series1,
  CHART_COLORS.series2,
  CHART_COLORS.series3,
  CHART_COLORS.series4,
  CHART_COLORS.series5,
];

export function RadialChart({
  data,
  xAxis,
  yAxis,
  title,
  description,
  showLegend = false,
  showGrid = true,
  showTooltip = true,
  formatValue = (value) => value.toLocaleString(),
  innerRadius = 60,
  outerRadius = 80,
}: RadialChartProps) {
  // Transform data for the chart
  const chartData = React.useMemo(() => {
    return data.map((item) => {
      const xValue = item[xAxis as keyof typeof item];
      const yValue = item[yAxis as keyof typeof item];
      return {
        name: String(xValue),
        value: Number(yValue),
        originalData: item
      };
    });
  }, [data, xAxis, yAxis]);

  // Create chart config
  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {
      value: {
        label: yAxis,
        value: 0,
        color: CHART_COLORS.primary
      }
    };
    
    return config;
  }, [yAxis]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_COLORS.primary}
                    stroke={CHART_COLORS.muted}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              {showTooltip && (
                <ChartTooltip>
                  <ChartTooltipContent />
                </ChartTooltip>
              )}
            </RechartsPieChart>
          </ResponsiveContainer>
        </ChartContainer>
        {showLegend && (
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CHART_COLORS.primary }}
                />
                <span className="text-sm text-gray-600">{item.name}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 