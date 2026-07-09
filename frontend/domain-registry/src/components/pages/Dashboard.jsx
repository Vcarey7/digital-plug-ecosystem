import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Globe, 
  Users, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../contexts/NotificationContext';

const Dashboard = () => {
  const { isAdmin, isTLDOwner } = useAuth();
  const { showError } = useNotification();
  
  const [timeRange, setTimeRange] = useState('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  // Mock data - in production, this would come from Firebase API
  const mockDashboardData = {
    kpis: {
      totalDomains: 12847,
      totalRevenue: 64235.50,
      activeTLDs: 15,
      dailyGrowth: 2.4,
      monthlyGrowth: 18.7,
      totalUsers: 3421
    },
    registrationTrend: [
      { date: '2024-01-01', domains: 120, revenue: 600 },
      { date: '2024-01-02', domains: 145, revenue: 725 },
      { date: '2024-01-03', domains: 132, revenue: 660 },
      { date: '2024-01-04', domains: 178, revenue: 890 },
      { date: '2024-01-05', domains: 156, revenue: 780 },
      { date: '2024-01-06', domains: 189, revenue: 945 },
      { date: '2024-01-07', domains: 203, revenue: 1015 }
    ],
    tldPerformance: [
      { name: '.plug', domains: 5420, revenue: 27100, percentage: 42.2 },
      { name: '.web3', domains: 3210, revenue: 16050, percentage: 25.0 },
      { name: '.crypto', domains: 2150, revenue: 10750, percentage: 16.7 },
      { name: '.nft', domains: 1320, revenue: 6600, percentage: 10.3 },
      { name: '.dao', domains: 747, revenue: 3735, percentage: 5.8 }
    ],
    recentTransactions: [
      { id: 1, domain: 'awesome.plug', type: 'registration', amount: 5.0, time: '2 minutes ago' },
      { id: 2, domain: 'crypto.web3', type: 'transfer', amount: 0, time: '5 minutes ago' },
      { id: 3, domain: 'defi.plug', type: 'registration', amount: 5.0, time: '8 minutes ago' },
      { id: 4, domain: 'nft.crypto', type: 'renewal', amount: 3.0, time: '12 minutes ago' },
      { id: 5, domain: 'dao.plug', type: 'registration', amount: 5.0, time: '15 minutes ago' }
    ],
    networkStats: {
      polygon: { domains: 8420, percentage: 65.5 },
      ethereum: { domains: 2847, percentage: 22.2 },
      bsc: { domains: 1580, percentage: 12.3 }
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // In production, this would be an API call to Firebase
        // const response = await axios.get(`/getDashboardData?timeRange=${timeRange}`);
        // setDashboardData(response.data.data);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        setDashboardData(mockDashboardData);
      } catch (error) {
        showError('Failed to Load Dashboard', error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [timeRange, showError]);

  const KPICard = ({ title, value, change, icon: Icon, format = 'number' }) => {
    const isPositive = change >= 0;
    const formattedValue = format === 'currency' 
      ? `$${value.toLocaleString()}` 
      : value.toLocaleString();

    return (
      <div className="luxury-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon size={24} className="text-primary" />
          </div>
          <div className={`flex items-center gap-1 text-sm ${
            isPositive ? 'text-green-400' : 'text-red-400'
          }`}>
            {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            {Math.abs(change)}%
          </div>
        </div>
        <div>
          <h3 className="text-2xl font-bold font-serif gold-gradient mb-1">
            {formattedValue}
          </h3>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </div>
    );
  };

  const COLORS = ['#FFD700', '#B8860B', '#DAA520', '#10B981', '#F59E0B'];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-serif font-bold gold-gradient">Dashboard</h1>
          <div className="flex items-center gap-2">
            <RefreshCw className="animate-spin" size={20} />
            <span>Loading...</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="luxury-card p-6 loading-pulse">
              <div className="h-24 bg-secondary rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold gold-gradient">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your Web3 domain registry.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          
          <button className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors">
            <Download size={16} />
            Export
          </button>
          
          <button className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Domains"
          value={dashboardData.kpis.totalDomains}
          change={dashboardData.kpis.dailyGrowth}
          icon={Globe}
        />
        <KPICard
          title="Total Revenue"
          value={dashboardData.kpis.totalRevenue}
          change={dashboardData.kpis.monthlyGrowth}
          icon={DollarSign}
          format="currency"
        />
        <KPICard
          title="Active TLDs"
          value={dashboardData.kpis.activeTLDs}
          change={0}
          icon={Activity}
        />
        <KPICard
          title="Total Users"
          value={dashboardData.kpis.totalUsers}
          change={12.3}
          icon={Users}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration Trend */}
        <div className="luxury-card p-6">
          <h3 className="text-lg font-semibold mb-4">Registration Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dashboardData.registrationTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,215,0,0.1)" />
              <XAxis dataKey="date" stroke="#CCCCCC" />
              <YAxis stroke="#CCCCCC" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1A1A1A', 
                  border: '1px solid #FFD700',
                  borderRadius: '8px'
                }}
              />
              <Area
                type="monotone"
                dataKey="domains"
                stroke="#FFD700"
                fill="url(#goldGradient)"
                strokeWidth={2}
              />
              <defs>
                <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#FFD700" stopOpacity={0}/>
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* TLD Performance */}
        <div className="luxury-card p-6">
          <h3 className="text-lg font-semibold mb-4">TLD Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dashboardData.tldPerformance}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="domains"
                label={({ name, percentage }) => `${name} ${percentage}%`}
              >
                {dashboardData.tldPerformance.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1A1A1A', 
                  border: '1px solid #FFD700',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 luxury-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
            <button className="text-primary hover:underline text-sm">View All</button>
          </div>
          
          <div className="space-y-3">
            {dashboardData.recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <div>
                    <p className="font-medium font-mono">{tx.domain}</p>
                    <p className="text-sm text-muted-foreground capitalize">{tx.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {tx.amount > 0 ? `${tx.amount} MATIC` : 'Transfer'}
                  </p>
                  <p className="text-sm text-muted-foreground">{tx.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Network Distribution */}
        <div className="luxury-card p-6">
          <h3 className="text-lg font-semibold mb-4">Network Distribution</h3>
          <div className="space-y-4">
            {Object.entries(dashboardData.networkStats).map(([network, stats]) => (
              <div key={network} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="capitalize font-medium">{network}</span>
                  <span>{stats.percentage}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-primary to-accent h-2 rounded-full"
                    style={{ width: `${stats.percentage}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.domains.toLocaleString()} domains
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="luxury-card p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="luxury-button">
            Register Domain
          </button>
          <button className="luxury-button">
            Mint AI Art
          </button>
          <button className="luxury-button">
            Create AI Agent
          </button>
          <button className="luxury-button">
            Bulk Operations
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

