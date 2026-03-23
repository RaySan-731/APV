import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  Calendar,
  Users,
  School,
  UserCheck,
  ClipboardList,
  Settings,
  HelpCircle,
  BarChart,
  Mountain,
  LogOut,
  Menu,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";

interface AppSidebarProps {
  userRole: UserRole;
}

const menuItems = {
  founder: [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Analytics", url: "/dashboard/analytics", icon: BarChart },
    { title: "Staff Management", url: "/dashboard/staff", icon: Users },
    { title: "Schools", url: "/dashboard/schools", icon: School },
    { title: "Events", url: "/dashboard/events", icon: Calendar },
    { title: "Programs", url: "/dashboard/programs", icon: ClipboardList },
    { title: "Settings", url: "/dashboard/settings", icon: Settings },
  ],
  commissioner: [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Programs", url: "/dashboard/programs", icon: ClipboardList },
    { title: "Events", url: "/dashboard/events", icon: Calendar },
    { title: "Schools", url: "/dashboard/schools", icon: School },
    { title: "Trainers", url: "/dashboard/trainers", icon: UserCheck },
  ],
  training_officer: [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Training Schedule", url: "/dashboard/schedule", icon: Calendar },
    { title: "Trainers", url: "/dashboard/trainers", icon: UserCheck },
    { title: "Programs", url: "/dashboard/programs", icon: ClipboardList },
  ],
  medical: [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Events", url: "/dashboard/events", icon: Calendar },
    { title: "Health Records", url: "/dashboard/health", icon: ClipboardList },
  ],
  rover: [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "My Schedule", url: "/dashboard/schedule", icon: Calendar },
    { title: "Schools", url: "/dashboard/schools", icon: School },
    { title: "Programs", url: "/dashboard/programs", icon: ClipboardList },
  ],
};

export function AppSidebar({ userRole }: AppSidebarProps) {
  const location = useLocation();
  const items = menuItems[userRole as keyof typeof menuItems] || [];

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar className="bg-gradient-forest border-r-0">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Mountain className="h-8 w-8 text-accent" />
          <span className="text-xl font-bold text-primary-foreground">Arrow-Park Ventures</span>
        </div>
        <SidebarTrigger className="text-primary-foreground hover:bg-sidebar-accent" />
      </div>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-primary-foreground/70">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "text-primary-foreground hover:bg-sidebar-accent",
                      isActive(item.url) && "bg-sidebar-primary text-sidebar-primary-foreground"
                    )}
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-primary-foreground/70">
            Support
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="text-primary-foreground hover:bg-sidebar-accent"
                >
                  <NavLink to="/help">
                    <HelpCircle className="h-4 w-4" />
                    <span>Help & FAQ</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarMenuButton
          className="text-primary-foreground hover:bg-sidebar-accent w-full justify-start"
          onClick={() => console.log("Logout")}
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}