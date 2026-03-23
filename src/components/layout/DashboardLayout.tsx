import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { UserRole } from "@/types";
import { Outlet } from "react-router-dom";

interface DashboardLayoutProps {
  userRole: UserRole;
}

export function DashboardLayout({ userRole }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar userRole={userRole} />
        <main className="flex-1 bg-background">
          <header className="h-16 border-b flex items-center px-6">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-xl font-semibold text-foreground">Arrow-Park Ventures Management System</h1>
          </header>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}