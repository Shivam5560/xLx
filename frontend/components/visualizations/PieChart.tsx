"use client"

import * as React from "react"
import { TrendingUp } from "lucide-react"
import { Label, Pie, PieChart as RechartsPieChart } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

interface PieChartProps {
  data: any[];
  xAxis: string;
  yAxis: string;
  title: string;
  description?: string;
  isDonut?: boolean;
}

export function PieChart({ data, xAxis, yAxis, title, description, isDonut = false }: PieChartProps) {
  // Transform data for the chart
  const chartData = React.useMemo(() => {
    const colors = [
      CHART_COLORS.series1,
      CHART_COLORS.series2,
      CHART_COLORS.series3,
      CHART_COLORS.series4,
      CHART_COLORS.series5,
    ];
    
    return data.map((item, index) => ({
      name: item[xAxis],
      value: Number(item[yAxis]),
      fill: colors[index % colors.length]
    }));
  }, [data, xAxis, yAxis]);

  // Calculate total for center text
  const total = React.useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.value, 0);
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
      const colors = [
        CHART_COLORS.series1,
        CHART_COLORS.series2,
        CHART_COLORS.series3,
        CHART_COLORS.series4,
        CHART_COLORS.series5,
      ];
      config[item.name] = {
        label: item.name,
        color: colors[index % colors.length],
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
          className="mx-auto aspect-square max-h-[250px]"
        >
          <RechartsPieChart>
            <ChartTooltip>
              <ChartTooltipContent hideLabel />
            </ChartTooltip>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={isDonut ? 60 : 0}
              strokeWidth={5}
              stroke={CHART_COLORS.muted}
            >
              {isDonut && (
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-3xl font-bold"
                          >
                            {total.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground"
                          >
                            {yAxis}
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              )}
            </Pie>
          </RechartsPieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          {chartData.length} categories <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Showing distribution of {yAxis} by {xAxis}
        </div>
      </CardFooter>
    </Card>
  );
} 