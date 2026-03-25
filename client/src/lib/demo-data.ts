import type { FileNode, AgentRun, PlanStep, ChatMessage, ApprovalRequest, ToolCall } from "./store";

export const DEMO_FILE_TREE: FileNode[] = [
  {
    name: "src",
    path: "/src",
    type: "directory",
    expanded: true,
    children: [
      {
        name: "components",
        path: "/src/components",
        type: "directory",
        expanded: false,
        children: [
          { name: "Header.tsx", path: "/src/components/Header.tsx", type: "file" },
          { name: "Sidebar.tsx", path: "/src/components/Sidebar.tsx", type: "file" },
          { name: "Button.tsx", path: "/src/components/Button.tsx", type: "file" },
          { name: "Modal.tsx", path: "/src/components/Modal.tsx", type: "file" },
        ],
      },
      {
        name: "pages",
        path: "/src/pages",
        type: "directory",
        expanded: true,
        children: [
          { name: "Home.tsx", path: "/src/pages/Home.tsx", type: "file" },
          { name: "Dashboard.tsx", path: "/src/pages/Dashboard.tsx", type: "file" },
          { name: "Settings.tsx", path: "/src/pages/Settings.tsx", type: "file" },
        ],
      },
      {
        name: "hooks",
        path: "/src/hooks",
        type: "directory",
        expanded: false,
        children: [
          { name: "useAuth.ts", path: "/src/hooks/useAuth.ts", type: "file" },
          { name: "useApi.ts", path: "/src/hooks/useApi.ts", type: "file" },
        ],
      },
      {
        name: "lib",
        path: "/src/lib",
        type: "directory",
        expanded: false,
        children: [
          { name: "utils.ts", path: "/src/lib/utils.ts", type: "file" },
          { name: "api.ts", path: "/src/lib/api.ts", type: "file" },
          { name: "constants.ts", path: "/src/lib/constants.ts", type: "file" },
        ],
      },
      { name: "App.tsx", path: "/src/App.tsx", type: "file" },
      { name: "main.tsx", path: "/src/main.tsx", type: "file" },
      { name: "index.css", path: "/src/index.css", type: "file" },
    ],
  },
  {
    name: "public",
    path: "/public",
    type: "directory",
    expanded: false,
    children: [
      { name: "favicon.ico", path: "/public/favicon.ico", type: "file" },
      { name: "robots.txt", path: "/public/robots.txt", type: "file" },
    ],
  },
  { name: "package.json", path: "/package.json", type: "file" },
  { name: "tsconfig.json", path: "/tsconfig.json", type: "file" },
  { name: "vite.config.ts", path: "/vite.config.ts", type: "file" },
  { name: "README.md", path: "/README.md", type: "file" },
  { name: ".gitignore", path: "/.gitignore", type: "file" },
];

export const DEMO_FILE_CONTENTS: Record<string, { content: string; language: string }> = {
  "/src/App.tsx": {
    language: "typescript",
    content: `import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { Home } from "./pages/Home";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-col flex-1">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}`,
  },
  "/src/pages/Home.tsx": {
    language: "typescript",
    content: `import { useState, useEffect } from "react";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  if (loading) return <div className="animate-pulse">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Welcome Home</h1>
      <div className="grid grid-cols-3 gap-4">
        {users.map((user) => (
          <div key={user.id} className="p-4 border rounded-lg">
            <h3 className="font-semibold">{user.name}</h3>
            <p className="text-sm text-gray-500">{user.email}</p>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              {user.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}`,
  },
  "/src/pages/Dashboard.tsx": {
    language: "typescript",
    content: `import { useMemo } from "react";

interface Metric {
  label: string;
  value: number;
  change: number;
}

const metrics: Metric[] = [
  { label: "Total Users", value: 12847, change: 12.5 },
  { label: "Active Sessions", value: 3421, change: -2.3 },
  { label: "Revenue", value: 48250, change: 8.1 },
  { label: "Conversion Rate", value: 3.2, change: 0.4 },
];

export function Dashboard() {
  const formattedMetrics = useMemo(
    () =>
      metrics.map((m) => ({
        ...m,
        formatted: m.label === "Revenue"
          ? \`$\${m.value.toLocaleString()}\`
          : m.label === "Conversion Rate"
          ? \`\${m.value}%\`
          : m.value.toLocaleString(),
      })),
    []
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-4 gap-6">
        {formattedMetrics.map((metric) => (
          <div key={metric.label} className="p-6 bg-white rounded-xl shadow-sm border">
            <p className="text-sm text-gray-500">{metric.label}</p>
            <p className="text-3xl font-bold mt-1">{metric.formatted}</p>
            <p className={\`text-sm mt-2 \${metric.change >= 0 ? "text-green-600" : "text-red-600"}\`}>
              {metric.change >= 0 ? "+" : ""}{metric.change}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}`,
  },
  "/package.json": {
    language: "json",
    content: `{
  "name": "my-web-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}`,
  },
  "/README.md": {
    language: "markdown",
    content: `# My Web App

A modern React application built with TypeScript and Vite.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Features

- React 19 with TypeScript
- Vite for fast development
- React Router for navigation
- Tailwind CSS for styling
`,
  },
};

const demoToolCalls: ToolCall[] = [
  {
    id: "tc-1",
    tool: "read_file",
    args: { path: "/src/pages/Home.tsx" },
    result: "File read successfully (42 lines)",
    status: "success",
  },
  {
    id: "tc-2",
    tool: "write_file",
    args: { path: "/src/pages/Home.tsx", content: "..." },
    result: "File written successfully",
    status: "success",
  },
  {
    id: "tc-3",
    tool: "run_terminal",
    args: { command: "npm test" },
    status: "running",
  },
];

export const DEMO_PLAN_STEPS: PlanStep[] = [
  {
    id: "step-1",
    title: "Analyze project structure",
    description: "Read package.json, tsconfig, and entry files to understand the codebase.",
    status: "complete",
    toolCalls: [demoToolCalls[0]],
    startedAt: Date.now() - 30000,
    completedAt: Date.now() - 25000,
  },
  {
    id: "step-2",
    title: "Refactor Home component",
    description: "Extract user card into a reusable component and add error boundary.",
    status: "complete",
    toolCalls: [demoToolCalls[0], demoToolCalls[1]],
    startedAt: Date.now() - 25000,
    completedAt: Date.now() - 15000,
  },
  {
    id: "step-3",
    title: "Add loading skeleton",
    description: "Replace simple loading text with a skeleton UI for better UX.",
    status: "active",
    toolCalls: [demoToolCalls[2]],
    startedAt: Date.now() - 15000,
  },
  {
    id: "step-4",
    title: "Run tests and verify",
    description: "Execute test suite and verify all changes work correctly.",
    status: "pending",
  },
];

export const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    role: "user",
    content: "Refactor the Home page to use a reusable UserCard component and add proper loading states.",
    timestamp: Date.now() - 35000,
  },
  {
    id: "msg-2",
    role: "assistant",
    content: "I'll analyze the project structure first, then refactor the Home component. Let me start by reading the current implementation.",
    timestamp: Date.now() - 33000,
  },
  {
    id: "msg-3",
    role: "tool",
    content: "Read /src/pages/Home.tsx (42 lines)",
    timestamp: Date.now() - 30000,
    toolCall: demoToolCalls[0],
  },
  {
    id: "msg-4",
    role: "assistant",
    content: "I can see the Home component has inline user cards and a basic loading state. I'll extract a `UserCard` component and add a skeleton loader. Let me make the changes.",
    timestamp: Date.now() - 28000,
  },
  {
    id: "msg-5",
    role: "tool",
    content: "Written /src/components/UserCard.tsx",
    timestamp: Date.now() - 22000,
    toolCall: demoToolCalls[1],
  },
  {
    id: "msg-6",
    role: "assistant",
    content: "I've created the UserCard component and updated the Home page. Now adding the skeleton loading state...",
    timestamp: Date.now() - 18000,
  },
];

export const DEMO_APPROVALS: ApprovalRequest[] = [
  {
    id: "apr-1",
    toolCall: {
      id: "tc-rm",
      tool: "run_terminal",
      args: { command: "rm -rf node_modules && npm install" },
      status: "pending",
      requiresApproval: true,
      riskLevel: "high",
    },
    description: "Agent wants to delete node_modules and reinstall dependencies",
    riskLevel: "high",
    timestamp: Date.now() - 5000,
    status: "pending",
  },
  {
    id: "apr-2",
    toolCall: {
      id: "tc-env",
      tool: "write_file",
      args: { path: "/.env", content: "DATABASE_URL=..." },
      status: "pending",
      requiresApproval: true,
      riskLevel: "medium",
    },
    description: "Agent wants to modify environment variables file",
    riskLevel: "medium",
    timestamp: Date.now() - 3000,
    status: "pending",
  },
];

export function createDemoRun(): AgentRun {
  return {
    id: "run-demo",
    title: "Refactor Home page with UserCard component",
    status: "running",
    plan: DEMO_PLAN_STEPS,
    messages: DEMO_MESSAGES,
    approvals: DEMO_APPROVALS,
    startedAt: Date.now() - 35000,
  };
}
