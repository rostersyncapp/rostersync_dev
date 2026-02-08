import React from 'react';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  loading?: boolean;
  trend?: 'up' | 'down' | 'neutral';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeLabel = 'vs last month',
  icon: Icon,
  loading = false,
  trend = 'neutral'
}) => {
  const trendColors = {
    up: 'text-emerald-600',
    down: 'text-red-600',
    neutral: 'text-gray-500'
  };
  
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
            {title}
          </p>
          {loading ? (
            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {value}
            </p>
          )}
        </div>
        <div className="p-3 bg-[#5B5FFF]/10 rounded-xl">
          <Icon className="w-6 h-6 text-[#5B5FFF]" />
        </div>
      </div>
      
      {change !== undefined && (
        <div className="mt-4 flex items-center gap-2">
          <TrendIcon className={`w-4 h-4 ${trendColors[trend]}`} />
          <span className={`text-sm font-bold ${trendColors[trend]}`}>
            {change > 0 ? '+' : ''}{change}%
          </span>
          <span className="text-xs text-gray-400 font-medium">{changeLabel}</span>
        </div>
      )}
    </div>
  );
};

export default MetricCard;