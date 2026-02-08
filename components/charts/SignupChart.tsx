import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface SignupData {
  date: string;
  signup_count: number;
}

interface SignupChartProps {
  data: SignupData[];
  loading?: boolean;
}

const SignupChart: React.FC<SignupChartProps> = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="h-80 w-full bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
      <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-6">
        User Signups (Last 30 Days)
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              stroke="#9CA3AF"
              fontSize={12}
            />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff'
              }}
              labelFormatter={(date) => new Date(date).toLocaleDateString()}
            />
            <Line
              type="monotone"
              dataKey="signup_count"
              stroke="#5B5FFF"
              strokeWidth={3}
              dot={{ fill: '#5B5FFF', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SignupChart;