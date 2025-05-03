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
  data: any[];
  xAxis: string;
  yAxis: string;
  title: string;
  description?: string;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
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
  innerRadius = 60,
  outerRadius = 80,
  showLegend = false,
}: RadialChartProps) {
  // Transform data for the chart
  const chartData = React.useMemo(() => {
    return data.map((item) => ({
      name: item[xAxis],
      value: item[yAxis],
    }));
  }, [data, xAxis, yAxis]);

  // Calculate total for center text
  const total = React.useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  // Create chart config
  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {
      value: {
        label: yAxis,
      }
    };
    
    // Add config for each unique category
    chartData.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length],
        value: item.value,
        percentage: (item.value / total) * 100
      };
    });

    return config;
  }, [chartData, yAxis, total]);

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
                    fill={CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length]}
                  />
                ))}
              </Pie>
              <ChartTooltip>
                <ChartTooltipContent />
              </ChartTooltip>
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground text-sm font-medium"
              >
                {total.toLocaleString()}
              </text>
            </RechartsPieChart>
          </ResponsiveContainer>
        </ChartContainer>
        {showLegend && (
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {chartData.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length] }}
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