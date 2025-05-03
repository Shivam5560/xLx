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
  data: any[];
  xAxis: string;
  yAxis: string;
  title: string;
  description?: string;
  barSize?: number;
  layout?: "vertical" | "horizontal";
}

export function BarChart({
  data,
  xAxis,
  yAxis,
  title,
  description,
  barSize = 40,
  layout = "vertical",
}: BarChartProps) {
  // Transform data for the chart
  const chartData = React.useMemo(() => {
    return data.map((item) => ({
      name: item[xAxis],
      value: item[yAxis],
    }));
  }, [data, xAxis, yAxis]);

  // Create chart config
  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {
      value: {
        label: yAxis,
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
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                type={layout === "vertical" ? "number" : "category"}
                dataKey={layout === "vertical" ? "value" : "name"}
                className="text-xs"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <YAxis
                type={layout === "vertical" ? "category" : "number"}
                dataKey={layout === "vertical" ? "name" : "value"}
                className="text-xs"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <ChartTooltip>
                <ChartTooltipContent />
              </ChartTooltip>
              <Bar
                dataKey="value"
                fill={CHART_COLORS.primary}
                radius={[4, 4, 0, 0]}
                barSize={barSize}
              />
            </RechartsBarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
} 