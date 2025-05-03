"use client"

import * as React from "react"
import { PolarAngleAxis, PolarGrid, Radar, RadarChart as RechartsRadarChart, ResponsiveContainer } from "recharts"

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

interface RadarChartProps {
  data: any[];
  xAxis: string;
  yAxis: string;
  title: string;
  description?: string;
  fillOpacity?: number;
}

export function RadarChart({
  data,
  xAxis,
  yAxis,
  title,
  description,
  fillOpacity = 0.2,
}: RadarChartProps) {
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
            <RechartsRadarChart data={chartData}>
              <PolarGrid stroke={CHART_COLORS.muted} />
              <PolarAngleAxis
                dataKey="name"
                className="text-xs"
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip>
                <ChartTooltipContent />
              </ChartTooltip>
              <Radar
                name={yAxis}
                dataKey="value"
                stroke={CHART_COLORS.primary}
                fill={CHART_COLORS.primary}
                fillOpacity={fillOpacity}
              />
            </RechartsRadarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
} 