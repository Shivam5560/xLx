"use client"

import * as React from "react"
import { Area, AreaChart as RechartsAreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

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

interface AreaChartProps {
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
  fillOpacity?: number;
  stackId?: string;
}

export function AreaChart({
  data,
  xAxis,
  yAxis,
  title,
  description,
  showLegend = false,
  showGrid = true,
  showTooltip = true,
  formatValue = (value) => value.toLocaleString(),
  fillOpacity = 0.2,
  stackId,
}: AreaChartProps) {
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
            <RechartsAreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                </linearGradient>
              </defs>
              {showGrid && (
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              )}
              <XAxis
                dataKey="name"
                className="text-xs"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                className="text-xs"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatValue}
              />
              {showTooltip && (
                <ChartTooltip>
                  <ChartTooltipContent />
                </ChartTooltip>
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke={CHART_COLORS.primary}
                fillOpacity={fillOpacity}
                fill="url(#colorValue)"
                stackId={stackId}
              />
            </RechartsAreaChart>
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