"use client"

import * as React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface ChartConfig {
  [key: string]: {
    label: string;
    color?: string;
    value?: number;
    percentage?: number;
  };
}

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig;
  title?: string;
  description?: string;
}

export function ChartContainer({
  config,
  title,
  description,
  className,
  children,
  ...props
}: ChartContainerProps) {
  return (
    <div className={cn("relative w-full", className)} {...props}>
      {title && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

interface ChartTooltipProps {
  children: React.ReactNode;
  cursor?: boolean;
  content?: React.ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
}

export function ChartTooltip({
  children,
  cursor = true,
  content,
  position = 'top',
}: ChartTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side={position} className="z-50">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  hideLabel?: boolean;
  formatValue?: (value: number) => string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel = false,
  formatValue = (value) => value.toLocaleString(),
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-popover p-2 shadow-sm">
      {!hideLabel && label && (
        <div className="mb-1 text-sm font-medium">{label}</div>
      )}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm">
            {entry.name}: {formatValue(entry.value)}
            {entry.percentage && ` (${entry.percentage.toFixed(1)}%)`}
          </span>
        </div>
      ))}
    </div>
  );
}

// Chart color palette based on ruby theme
export const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  muted: "hsl(var(--muted))",
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  error: "hsl(var(--destructive))",
  // Additional colors for multiple series
  series1: "hsl(var(--chart-1))",
  series2: "hsl(var(--chart-2))",
  series3: "hsl(var(--chart-3))",
  series4: "hsl(var(--chart-4))",
  series5: "hsl(var(--chart-5))",
};

// Chart dimensions and spacing
export const CHART_DIMENSIONS = {
  container: {
    width: 800,
    height: 500,
  },
  padding: {
    top: 60,
    right: 60,
    bottom: 50,
    left: 80,
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
  radar: {
    size: 300,
    levels: 5,
  },
  radial: {
    size: 200,
    innerRadius: 60,
  },
}; 