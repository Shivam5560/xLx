"use client"

import * as React from "react"
import { Bar, BarChart as RechartsBarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts"

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

interface BarChartProps {
  data: Array<{
    name: string;
    value: number;
    [key: string]: any;
  }>;
  xAxis: string;
  yAxis: string;
  title: string;
  description?: string;
  barSize?: number;
  layout?: "vertical" | "horizontal";
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  formatValue?: (value: number) => string;
}

export function BarChart({
  data,
  xAxis,
  yAxis,
  title,
  description,
  barSize = 40,
  layout = "horizontal",
  showLegend = false,
  showGrid = true,
  showTooltip = true,
  formatValue = (value) => value.toLocaleString(),
}: BarChartProps) {
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
            <RechartsBarChart
              data={chartData}
              layout={layout}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              {showGrid && (
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              )}
              <XAxis
                type={layout === "vertical" ? "number" : "category"}
                dataKey={layout === "vertical" ? "value" : "name"}
                className="text-xs"
                tickLine={false}
                axisLine={false}
                tickFormatter={layout === "vertical" ? formatValue : undefined}
                interval={0}
                minTickGap={20}
              />
              <YAxis
                type={layout === "vertical" ? "category" : "number"}
                dataKey={layout === "vertical" ? "name" : "value"}
                className="text-xs"
                tickLine={false}
                axisLine={false}
                tickFormatter={layout === "vertical" ? undefined : formatValue}
              />
              {showTooltip && (
                <ChartTooltip>
                  <ChartTooltipContent />
                </ChartTooltip>
              )}
              <Bar
                dataKey="value"
                fill={CHART_COLORS.primary}
                radius={[4, 4, 0, 0]}
                barSize={barSize}
              />
            </RechartsBarChart>
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