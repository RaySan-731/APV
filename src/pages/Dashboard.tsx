import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, School, TrendingUp, Settings, BarChart3, ClipboardList } from "lucide-react";
import { useLocation } from "react-router-dom";

const Dashboard = () => {
  const location = useLocation();
  
  // Get the current page from the URL path
  const currentPage = location.pathname.split('/').pop() || 'dashboard';
  
  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard':
        return 'Dashboard';
      case 'analytics':
        return 'Analytics';
      case 'staff':
        return 'Staff Management';
      case 'schools':
        return 'Schools';
      case 'events':
        return 'Events';
      case 'programs':
        return 'Programs';
      case 'settings':
        return 'Settings';
      case 'trainers':
        return 'Trainers';
      case 'schedule':
        return 'Training Schedule';
      case 'health':
        return 'Health Records';
      default:
        return 'Dashboard';
    }
  };

  const getPageContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
                  <School className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">25</div>
                  <p className="text-xs text-muted-foreground">+3 this month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Students</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">523</div>
                  <p className="text-xs text-muted-foreground">+48 this week</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8</div>
                  <p className="text-xs text-muted-foreground">Next: Summer Camp</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">+24%</div>
                  <p className="text-xs text-muted-foreground">Year over year</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">New team member onboarded</p>
                      <p className="text-sm text-muted-foreground">John Smith joined as Venture Manager</p>
                    </div>
                    <span className="text-sm text-muted-foreground">2 hours ago</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Q1 strategy launch</p>
                      <p className="text-sm text-muted-foreground">15 initiatives already in progress</p>
                    </div>
                    <span className="text-sm text-muted-foreground">1 day ago</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">New partnership agreement</p>
                      <p className="text-sm text-muted-foreground">Strategic Corp joined our network</p>
                    </div>
                    <span className="text-sm text-muted-foreground">3 days ago</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        );
      
      case 'analytics':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Analytics dashboard content will be displayed here.</p>
            </CardContent>
          </Card>
        );
      
      case 'staff':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Staff Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Staff management interface will be displayed here.</p>
            </CardContent>
          </Card>
        );
      
      case 'schools':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="h-5 w-5" />
                Schools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">School management interface will be displayed here.</p>
            </CardContent>
          </Card>
        );
      
      case 'events':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Events management interface will be displayed here.</p>
            </CardContent>
          </Card>
        );
      
      case 'programs':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Programs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Programs management interface will be displayed here.</p>
            </CardContent>
          </Card>
        );
      
      case 'settings':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Application settings will be displayed here.</p>
            </CardContent>
          </Card>
        );
      
      default:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Page Under Development</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">This page is currently under development.</p>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{getPageTitle()}</h1>
        <p className="text-muted-foreground">Welcome back, Founder</p>
      </div>
      
      {getPageContent()}
    </div>
  );
};

export default Dashboard;