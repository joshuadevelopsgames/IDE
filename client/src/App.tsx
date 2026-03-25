import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useIDEStore } from "./lib/store";
import Home from "./pages/Home";
import Workspace from "./pages/Workspace";

function AppContent() {
  const activeView = useIDEStore((s) => s.activeView);

  if (activeView === "workspace") {
    return <Workspace />;
  }

  return <Home />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
