import { CentraConnector, ZettleConnector } from '@/lib/connectors';
import { COMPANIES, type CompanyId } from '@/config/companies';
import type { Env, SalesData, PeriodType, ComparisonType, SalesOverview, ChannelSales, DashboardData, CompanySummary, TimeSlotChartData, TimeSlotSalesData, TimeSlotId, CustomDateRange } from '@/types';
import { getDateRange, getCustomDateRange } from '@/lib/utils/date';
import { calculatePercentChange } from '@/lib/utils/currency';
import { getTimeSlotFromHour, getDayLabel, formatDateKey } from '@/lib/utils/time-slots';

export class SalesAggregator {
  constructor(private env: Env) {}

  async fetchDashboardData(
    companyId: CompanyId,
    period: PeriodType,
    comparison: ComparisonType = 'period',
    customDateRange?: CustomDateRange
  ): Promise<DashboardData> {
    // Get date ranges - use custom range if provided for 'custom' period
    const { current, previous } = period === 'custom' && customDateRange
      ? getCustomDateRange(customDateRange, comparison)
      : getDateRange(period, comparison);

    // Get companies to fetch data for
    const companyConfig = COMPANIES[companyId];
    const companyIds: CompanyId[] = companyConfig.companies || [companyId];

    // Fetch data for all companies in parallel
    const companyResults = await Promise.all(
      companyIds.map(id => this.fetchCompanyData(id, current.start, current.end, previous.start, previous.end))
    );

    // Aggregate results
    const allChannels: ChannelSales[] = [];
    let totalCurrent = 0;
    let totalPrevious = 0;
    let totalOrdersCurrent = 0;
    let totalOrdersPrevious = 0;
    let totalProductsCurrent = 0;
    let totalProductsPrevious = 0;

    // Track per-company data for summaries
    const companySummaries: CompanySummary[] = [];

    for (const result of companyResults) {
      let companyTotalCurrent = 0;
      let companyTotalPrevious = 0;
      let companyOrdersCurrent = 0;
      let companyOrdersPrevious = 0;
      let companyProductsCurrent = 0;
      let companyProductsPrevious = 0;
      // B2C only (excludes B2B)
      let b2cAmountCurrent = 0;
      let b2cAmountPrevious = 0;
      let b2cOrdersCurrent = 0;
      let b2cOrdersPrevious = 0;

      for (const channel of result.channels) {
        allChannels.push(channel);

        // Total aggregation
        totalCurrent += channel.sales.current.amount;
        totalPrevious += channel.sales.previous.amount;
        totalOrdersCurrent += channel.sales.current.orderCount;
        totalOrdersPrevious += channel.sales.previous.orderCount;
        totalProductsCurrent += channel.sales.current.productCount;
        totalProductsPrevious += channel.sales.previous.productCount;

        // Company aggregation
        companyTotalCurrent += channel.sales.current.amount;
        companyTotalPrevious += channel.sales.previous.amount;
        companyOrdersCurrent += channel.sales.current.orderCount;
        companyOrdersPrevious += channel.sales.previous.orderCount;
        companyProductsCurrent += channel.sales.current.productCount;
        companyProductsPrevious += channel.sales.previous.productCount;

        // B2C aggregation (exclude B2B channels)
        const isB2B = channel.channel.includes('centra-b2b');
        if (!isB2B) {
          b2cAmountCurrent += channel.sales.current.amount;
          b2cAmountPrevious += channel.sales.previous.amount;
          b2cOrdersCurrent += channel.sales.current.orderCount;
          b2cOrdersPrevious += channel.sales.previous.orderCount;
        }
      }

      // Calculate B2C average order value
      const b2cAvgCurrent = b2cOrdersCurrent > 0 ? Math.round(b2cAmountCurrent / b2cOrdersCurrent) : 0;
      const b2cAvgPrevious = b2cOrdersPrevious > 0 ? Math.round(b2cAmountPrevious / b2cOrdersPrevious) : 0;

      companySummaries.push({
        companyId: result.companyId,
        companyName: result.name,
        totalSales: {
          current: { amount: companyTotalCurrent, orderCount: companyOrdersCurrent, productCount: companyProductsCurrent },
          previous: { amount: companyTotalPrevious, orderCount: companyOrdersPrevious, productCount: companyProductsPrevious },
          percentChange: calculatePercentChange(companyTotalCurrent, companyTotalPrevious),
        },
        b2cAverageOrderValue: {
          current: { amount: b2cAvgCurrent, orderCount: b2cOrdersCurrent, productCount: 0 },
          previous: { amount: b2cAvgPrevious, orderCount: b2cOrdersPrevious, productCount: 0 },
          percentChange: calculatePercentChange(b2cAvgCurrent, b2cAvgPrevious),
        },
        channels: result.channels,
      });
    }

    const dashboardData: DashboardData = {
      period,
      company: companyConfig.name,
      totalSales: {
        current: { amount: totalCurrent, orderCount: totalOrdersCurrent, productCount: totalProductsCurrent },
        previous: { amount: totalPrevious, orderCount: totalOrdersPrevious, productCount: totalProductsPrevious },
        percentChange: calculatePercentChange(totalCurrent, totalPrevious),
      },
      channels: allChannels,
      dateRanges: {
        current: {
          start: current.start,
          end: current.end,
          label: current.displayLabel,
        },
        previous: {
          start: previous.start,
          end: previous.end,
          label: previous.displayLabel,
        },
      },
    };

    // Include company summaries only for 'all' view
    if (companyId === 'all') {
      dashboardData.companySummaries = companySummaries;
    }

    return dashboardData;
  }

  /**
   * Fetch time-slot aggregated data for bar chart visualization
   * Groups sales by day and 6-hour time slots (00-06, 06-12, 12-18, 18-24)
   * Separates store (Zettle) and e-commerce (Centra B2C), excludes B2B
   */
  async fetchTimeSlotData(
    companyId: CompanyId,
    startDate: string,
    endDate: string
  ): Promise<TimeSlotChartData> {
    const companyConfig = COMPANIES[companyId];
    const companyIds: CompanyId[] = companyConfig.companies || [companyId];

    // Initialize structure for all days in range
    const days = new Map<string, TimeSlotSalesData>();

    // Parse dates and iterate through each day
    const start = new Date(startDate.split('T')[0]);
    const end = new Date(endDate.split('T')[0]);
    const current = new Date(start);

    while (current <= end) {
      const dateKey = formatDateKey(current);
      days.set(dateKey, {
        date: dateKey,
        dayLabel: getDayLabel(current),
        slots: {
          night: { store: 0, ecommerce: 0 },
          morning: { store: 0, ecommerce: 0 },
          afternoon: { store: 0, ecommerce: 0 },
          evening: { store: 0, ecommerce: 0 },
        },
      });
      current.setDate(current.getDate() + 1);
    }

    // Fetch data from each company
    for (const id of companyIds) {
      const config = COMPANIES[id];
      if (!config.connectors) continue;

      for (const connector of config.connectors) {
        // Skip B2B connectors
        if (connector.type === 'centra-b2b') continue;

        try {
          if (connector.type === 'zettle') {
            const zettle = new ZettleConnector(this.env, connector.envPrefix);
            const purchases = await zettle.fetchPurchasesWithTimestamps(startDate, endDate);

            for (const purchase of purchases) {
              const date = purchase.timestamp.split('T')[0];
              const hour = new Date(purchase.timestamp).getHours();
              const slot = getTimeSlotFromHour(hour);

              const day = days.get(date);
              if (day) {
                day.slots[slot].store += purchase.amount;
              }
            }
          } else if (connector.type === 'centra-b2c') {
            const centra = new CentraConnector(this.env, connector.envPrefix, false);
            const orders = await centra.fetchOrdersWithTimestamps(startDate, endDate);

            for (const order of orders) {
              const date = order.createdAt.split('T')[0];
              const hour = new Date(order.createdAt).getHours();
              const slot = getTimeSlotFromHour(hour);

              const day = days.get(date);
              if (day) {
                day.slots[slot].ecommerce += order.amount;
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching time-slot data for ${connector.type}:`, error);
        }
      }
    }

    // Calculate totals
    let totalStore = 0;
    let totalEcommerce = 0;

    for (const day of days.values()) {
      for (const slot of Object.values(day.slots)) {
        totalStore += slot.store;
        totalEcommerce += slot.ecommerce;
      }
    }

    return {
      days: Array.from(days.values()),
      totals: { store: totalStore, ecommerce: totalEcommerce },
    };
  }

  private async fetchCompanyData(
    companyId: CompanyId,
    currentStart: string,
    currentEnd: string,
    previousStart: string,
    previousEnd: string
  ): Promise<{ companyId: CompanyId; name: string; channels: ChannelSales[] }> {
    const config = COMPANIES[companyId];
    if (!config.connectors) {
      return { companyId, name: config.name, channels: [] };
    }

    const channels: ChannelSales[] = [];

    for (const connector of config.connectors) {
      try {
        const channelData = await this.fetchConnectorData(
          connector,
          currentStart,
          currentEnd,
          previousStart,
          previousEnd
        );

        if (channelData) {
          channels.push({
            channel: `${companyId}-${connector.type}`,
            label: `${config.name} - ${connector.label}`,
            ...channelData,
          });
        }
      } catch (error) {
        console.error(`Error fetching ${connector.type} for ${config.name}:`, error);
        // Continue with other connectors
      }
    }

    return { companyId, name: config.name, channels };
  }

  private async fetchConnectorData(
    connector: { type: string; envPrefix: string; showIfZero?: boolean; trackReturns?: boolean },
    currentStart: string,
    currentEnd: string,
    previousStart: string,
    previousEnd: string
  ): Promise<{ sales: SalesOverview; returns?: SalesOverview } | null> {
    try {
      switch (connector.type) {
        case 'zettle': {
          const zettle = new ZettleConnector(this.env, connector.envPrefix);
          const [currentData, previousData] = await Promise.all([
            zettle.fetchSales(currentStart, currentEnd),
            zettle.fetchSales(previousStart, previousEnd),
          ]);

          return {
            sales: {
              current: currentData,
              previous: previousData,
              percentChange: calculatePercentChange(currentData.amount, previousData.amount),
            },
          };
        }

        case 'centra-b2c':
        case 'centra-b2b': {
          const isB2B = connector.type === 'centra-b2b';
          const centra = new CentraConnector(this.env, connector.envPrefix, isB2B);
          const [currentData, previousData] = await Promise.all([
            centra.fetchSales(currentStart, currentEnd),
            centra.fetchSales(previousStart, previousEnd),
          ]);

          const result: { sales: SalesOverview; returns?: SalesOverview } = {
            sales: {
              current: currentData.sales,
              previous: previousData.sales,
              percentChange: calculatePercentChange(currentData.sales.amount, previousData.sales.amount),
            },
          };

          if (connector.trackReturns) {
            result.returns = {
              current: currentData.returns,
              previous: previousData.returns,
              percentChange: calculatePercentChange(currentData.returns.amount, previousData.returns.amount),
            };
          }

          return result;
        }

        default:
          console.warn(`Unknown connector type: ${connector.type}`);
          return null;
      }
    } catch (error) {
      console.error(`Connector ${connector.type} failed:`, error);
      return null;
    }
  }
}
