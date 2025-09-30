import React, { useMemo, useRef, useState, useEffect } from "react";
import Papa from "papaparse";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

// Icons
import { Upload, Download, RefreshCw, Filter, X, Search } from "react-feather";

// Power BI Integration
import { PowerBIEmbed } from "powerbi-client-react";
import { models } from "powerbi-client";

// Sample Color Palette (Modern API-themed: blues, purples, teals)
const THEME_COLORS = {
  primary: "#3B82F6",   // Blue
  secondary: "#8B5CF6", // Purple
  accent: "#06B6D4",    // Cyan/Teal
  success: "#10B981",   // Green
  warning: "#F59E0B",   // Amber
  danger: "#EF4444",    // Red
  gray: "#6B7280",      // Gray
  dark: "#1F2937",      // Dark Gray
};

const COLORS = [
  THEME_COLORS.primary,
  THEME_COLORS.secondary,
  THEME_COLORS.accent,
  THEME_COLORS.success,
  THEME_COLORS.warning,
  THEME_COLORS.danger,
];

const Dashboard = () => {
  const [rowData, setRowData] = useState([]);
  const [columnDefs, setColumnDefs] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [numericFilters, setNumericFilters] = useState({});
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const gridRef = useRef();
  const fileInputRef = useRef(null);

  // 🔹 Power BI State
  const [pbiEmbedConfig, setPbiEmbedConfig] = useState(null);
  const [showPbi, setShowPbi] = useState(false);

  // Example Power BI Embed URL (replace with your actual embed URL)
  const POWER_BI_EMBED_URL =
    "https://app.powerbi.com/reportEmbed?reportId=your-report-id&groupId=your-group-id";

  // Initialize Power BI config on mount (or via button)
  useEffect(() => {
    if (showPbi) {
      setPbiEmbedConfig({
        type: "report",
        id: "your-report-id", // Replace
        embedUrl: POWER_BI_EMBED_URL,
        accessToken: "your-access-token", // From backend secure source
        tokenType: models.TokenType.Embed,
        settings: {
          panes: {
            filters: { visible: false },
            pageNavigation: { visible: true },
          },
          background: models.BackgroundType.Transparent,
        },
      });
    }
  }, [showPbi]);

  // 🔹 Filter Logic
  useEffect(() => {
    let result = [...rowData];

    // Text search across all fields
    if (filterText) {
      result = result.filter((row) =>
        Object.values(row).some((value) =>
          String(value).toLowerCase().includes(filterText.toLowerCase())
        )
      );
    }

    // Date range filter (assumes a 'Date' field exists)
    if (dateRange.start || dateRange.end) {
      result = result.filter((row) => {
        const dateStr = row.Date || row.date || null;
        if (!dateStr) return true;
        const date = new Date(dateStr);
        const start = dateRange.start ? new Date(dateRange.start) : null;
        const end = dateRange.end ? new Date(dateRange.end) : null;
        return (
          (!start || date >= start) &&
          (!end || date <= end)
        );
      });
    }

    // Numeric filters (e.g., Sales > 1000)
    Object.entries(numericFilters).forEach(([field, { min, max }]) => {
      if (min !== "" || max !== "") {
        result = result.filter((row) => {
          const val = parseFloat(row[field]);
          return (
            (!min || val >= parseFloat(min)) &&
            (!max || val <= parseFloat(max))
          );
        });
      }
    });

    setFilteredData(result);
  }, [rowData, filterText, dateRange, numericFilters]);

  // 🔹 File Upload Handler
  const onFileUpload = (event) => {
    const file = event.target.files[0];
    const fileExtension = file.name.split(".").pop().toLowerCase();

    if (fileExtension === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setRowData(results.data);
          setColumnDefs(
            results.meta.fields.map((field) => ({
              headerName: field,
              field,
              filter: true,
              sortable: true,
            }))
          );
        },
      });
    } else if (["xlsx", "xls"].includes(fileExtension)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
        setRowData(jsonData);
        setColumnDefs(
          Object.keys(jsonData[0] || {}).map((field) => ({
            headerName: field,
            field,
            filter: true,
            sortable: true,
          }))
        );
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert("Unsupported format. Please upload CSV or Excel.");
    }
    event.target.value = null;
  };

  // 🔹 Export CSV
  const onExport = () => {
    gridRef.current?.api.exportDataAsCsv({ fileName: "dashboard-export.csv" });
  };

  // 🔹 Reset All
  const onRefresh = () => {
    setRowData([]);
    setColumnDefs([]);
    setFilteredData([]);
    setFilterText("");
    setDateRange({ start: "", end: "" });
    setNumericFilters({});
    setSelectedColumn("");
    setShowPbi(false);
  };

  // 🔹 KPIs Calculation
  const kpis = useMemo(() => {
    if (filteredData.length === 0) return {};

    const totalRows = filteredData.length;

    // Assume numeric fields like 'Sales', 'Revenue', etc.
    const salesField = columnDefs.find(col => col.field.toLowerCase().includes('sales') || col.field.toLowerCase().includes('revenue'))?.field;
    
    const totalSales = salesField
      ? filteredData.reduce((sum, row) => sum + (parseFloat(row[salesField]) || 0), 0)
      : 0;

    const avgSales = totalRows ? totalSales / totalRows : 0;

    return { totalRows, totalSales, avgSales };
  }, [filteredData, columnDefs]);

  // 🔹 Chart Data: Group by first string column
  const chartData = useMemo(() => {
    if (filteredData.length === 0) return [];

    const groupByField = Object.keys(filteredData[0] || {})[0] || "Category";
    const counts = {};

    filteredData.forEach((row) => {
      const key = row[groupByField] || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value], i) => ({
      name,
      count: value,
      fill: COLORS[i % COLORS.length],
    }));
  }, [filteredData]);

  // 🔹 Time Series Data (if Date field exists)
  const timeSeriesData = useMemo(() => {
    const dateField = "Date"; // Change based on your data
    const valueField = columnDefs[1]?.field || "Value";

    return filteredData
      .filter((row) => row[dateField])
      .map((row) => ({
        date: new Date(row[dateField]).toLocaleDateString(),
        [valueField]: parseFloat(row[valueField]) || 0,
      }));
  }, [filteredData, columnDefs]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-6 py-4">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload data, explore insights, and visualize trends.
        </p>
      </header>

      <div className="p-6 space-y-6">

        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-lg shadow">
          <div className="flex flex-wrap gap-3">
            <label className="btn flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md cursor-pointer transition">
              <Upload size={16} /> Upload File
              <input
                type="file"
                ref={fileInputRef}
                onChange={onFileUpload}
                accept=".csv,.xlsx,.xls"
                className="hidden"
              />
            </label>

            <button
              onClick={onExport}
              disabled={!rowData.length}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition"
            >
              <Download size={16} /> Export
            </button>

            <button
              onClick={onRefresh}
              className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition"
            >
              <RefreshCw size={16} /> Reset
            </button>

            <button
              onClick={() => setShowPbi(!showPbi)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition ${
                showPbi ? "bg-purple-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
              }`}
            >
              {showPbi ? "Hide" : "Show"} Power BI
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search all data..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* KPI Cards */}
        {kpis.totalRows !== undefined && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border text-center">
              <h3 className="text-lg font-medium text-gray-500">Total Records</h3>
              <p className="text-3xl font-bold text-gray-900">{kpis.totalRows}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border text-center">
              <h3 className="text-lg font-medium text-gray-500">Total Sales</h3>
              <p className="text-3xl font-bold text-blue-600">${kpis.totalSales.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border text-center">
              <h3 className="text-lg font-medium text-gray-500">Avg per Record</h3>
              <p className="text-3xl font-bold text-green-600">${kpis.avgSales.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Filter size={18} /> Advanced Filters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            {/* Numeric Filters */}
            {columnDefs
              .filter((col) => !isNaN(parseFloat(rowData[0]?.[col.field])))
              .map((col) => (
                <div key={col.field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {col.headerName}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                      onChange={(e) =>
                        setNumericFilters({
                          ...numericFilters,
                          [col.field]: { ...numericFilters[col.field], min: e.target.value },
                        })
                      }
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                      onChange={(e) =>
                        setNumericFilters({
                          ...numericFilters,
                          [col.field]: { ...numericFilters[col.field], max: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="bg-white p-5 rounded-xl shadow-sm border h-80">
            <h3 className="text-lg font-semibold mb-2">Distribution</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill={THEME_COLORS.primary} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className="bg-white p-5 rounded-xl shadow-sm border h-80">
            <h3 className="text-lg font-semibold mb-2">Breakdown</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Line Chart */}
          <div className="bg-white p-5 rounded-xl shadow-sm border h-80">
            <h3 className="text-lg font-semibold mb-2">Trend Over Time</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey={Object.keys(timeSeriesData[0] || {})[1] || "value"} stroke={THEME_COLORS.secondary} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Area Chart */}
          <div className="bg-white p-5 rounded-xl shadow-sm border h-80">
            <h3 className="text-lg font-semibold mb-2">Area Trend</h3>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey={Object.keys(timeSeriesData[0] || {})[1] || "value"} fill={THEME_COLORS.accent} stroke={THEME_COLORS.accent} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Power BI Embedded */}
        {showPbi && (
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">Power BI Report</h3>
            <div style={{ height: "600px" }}>
              {pbiEmbedConfig ? (
                <PowerBIEmbed
                  embedConfig={pbiEmbedConfig}
                  eventHandlers={
                    new Map([
                      ["loaded", function () { console.log("Report loaded"); }],
                      ["error", function (event) { console.error("Error:", event.detail); }],
                    ])
                  }
                  cssClassName={"powerbi-report"}
                  getEmbeddedComponent={(embeddedReport) => {
                    window.report = embeddedReport;
                  }}
                />
              ) : (
                <p>Loading Power BI...</p>
              )}
            </div>
          </div>
        )}

        {/* Data Table */}
        {filteredData.length > 0 && (
          <div className="ag-theme-quartz" style={{ height: 500, marginTop: "2rem" }}>
            <AgGridReact
              ref={gridRef}
              rowData={filteredData}
              columnDefs={columnDefs}
              pagination={true}
              paginationPageSize={10}
              domLayout="autoHeight"
              defaultColDef={{
                resizable: true,
                sortable: true,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;