'use client';

import React, { Fragment, useMemo, useState, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TIME_SLOTS,
  STORE_COLORS,
  ECOMMERCE_COLORS,
} from '@/lib/utils/time-slots';
import type { TimeSlotChartData, TimeSlotId } from '@/types';

// Darker variants for hover state
const STORE_COLORS_HOVER: Record<TimeSlotId, string> = {
  night: '#B5AA9A',
  morning: '#D08A6A',
  afternoon: '#7BA8A6',
  evening: '#4A7585',
};

const ECOMMERCE_COLORS_HOVER: Record<TimeSlotId, string> = {
  night: '#D4C9BA',
  morning: '#E5A68E',
  afternoon: '#9BC5C3',
  evening: '#5E919F',
};

interface TimeSlotChartProps {
  data: TimeSlotChartData | null;
  isLoading?: boolean;
}

export function TimeSlotChart({ data, isLoading }: TimeSlotChartProps) {
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Transform data for Recharts grouped bar format
  // Each day has 4 bars (one per time slot), each bar is stacked with store + ecommerce
  const chartData = useMemo(() => {
    if (!data) return [];

    return data.days.map((day) => {
      const entry: Record<string, string | number> = {
        day: day.dayLabel,
        date: day.date,
      };

      // Add each time slot's store and ecommerce values
      for (const slot of TIME_SLOTS) {
        entry[`${slot.id}_store`] = day.slots[slot.id as TimeSlotId].store;
        entry[`${slot.id}_ecom`] = day.slots[slot.id as TimeSlotId].ecommerce;
      }

      return entry;
    });
  }, [data]);

  // Get tooltip data for active day
  const tooltipData = useMemo(() => {
    if (activeDayIndex === null || !chartData[activeDayIndex]) return null;

    const dayData = chartData[activeDayIndex];
    let totalStore = 0;
    let totalEcom = 0;

    for (const slot of TIME_SLOTS) {
      totalStore += (dayData[`${slot.id}_store`] as number) || 0;
      totalEcom += (dayData[`${slot.id}_ecom`] as number) || 0;
    }

    const dateStr = dayData.date as string;
    const [, month, day] = dateStr.split('-');
    const formattedDate = `${parseInt(day)}/${parseInt(month)}`;

    return { formattedDate, totalStore, totalEcom };
  }, [activeDayIndex, chartData]);

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!data || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Ingen data tillgänglig
      </div>
    );
  }

  const formatYAxis = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toString();
  };

  const handleBarMouseEnter = (dayIndex: number) => {
    setActiveDayIndex(dayIndex);
  };

  const handleBarMouseLeave = () => {
    setActiveDayIndex(null);
    setMousePos(null);
  };

  const updateMousePos = (event: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  };

  const getBarFill = (slotId: TimeSlotId, dayIndex: number, isStore: boolean) => {
    const isHovered = activeDayIndex === dayIndex;
    if (isStore) {
      return isHovered ? STORE_COLORS_HOVER[slotId] : STORE_COLORS[slotId];
    }
    return isHovered ? ECOMMERCE_COLORS_HOVER[slotId] : ECOMMERCE_COLORS[slotId];
  };

  return (
    <div
      className="h-48 relative"
      ref={containerRef}
      onMouseMove={(e) => updateMousePos(e)}
      onMouseLeave={handleBarMouseLeave}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={35}
          />

          {/* Render stacked bars for each time slot */}
          {TIME_SLOTS.map((slot) => (
            <Fragment key={slot.id}>
              {/* Store (darker color) - bottom of stack */}
              <Bar
                dataKey={`${slot.id}_store`}
                stackId={slot.id}
                radius={[0, 0, 0, 0]}
                maxBarSize={12}
                onMouseEnter={(_, index) => handleBarMouseEnter(index)}
                onMouseLeave={handleBarMouseLeave}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`store-${index}`}
                    fill={getBarFill(slot.id as TimeSlotId, index, true)}
                  />
                ))}
              </Bar>
              {/* E-commerce (lighter color) - top of stack */}
              <Bar
                dataKey={`${slot.id}_ecom`}
                stackId={slot.id}
                radius={[2, 2, 0, 0]}
                maxBarSize={12}
                onMouseEnter={(_, index) => handleBarMouseEnter(index)}
                onMouseLeave={handleBarMouseLeave}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`ecom-${index}`}
                    fill={getBarFill(slot.id as TimeSlotId, index, false)}
                  />
                ))}
              </Bar>
            </Fragment>
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Custom tooltip */}
      {tooltipData && mousePos && (
        <div
          className="absolute rounded-md border bg-popover px-3 py-2 text-xs shadow-md pointer-events-none z-10"
          style={{
            left: mousePos.x + 10,
            top: mousePos.y - 10,
            transform: mousePos.x > 150 ? 'translateX(-100%)' : undefined,
          }}
        >
          <p className="font-medium mb-1">{tooltipData.formattedDate}</p>
          <p className="text-muted-foreground">
            Butik: {tooltipData.totalStore.toLocaleString('sv-SE')} kr
          </p>
          <p className="text-muted-foreground">
            Ecom: {tooltipData.totalEcom.toLocaleString('sv-SE')} kr
          </p>
        </div>
      )}
    </div>
  );
}
