import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mountain, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Demo login logic - in production this would authenticate with backend
    if (email === "founder@apventures.com" && password === "admin") {
      toast({
        title: "Welcome back!",
        description: "Successfully logged in as Founder",
      });
      navigate("/dashboard");
    } else if (email && password) {
      toast({
        title: "Demo Mode",
        description: "Use founder@apventures.com / admin to login",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-forest flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <ArrowLeft className="h-5 w-5 text-primary-foreground" />
          <span className="text-primary-foreground hover:text-accent transition-colors">Back to Home</span>
        </Link>
        
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Mountain className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">Member Login</CardTitle>
            <CardDescription>
              Access your Arrow-Park Ventures dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" variant="hero">
                Sign In
              </Button>
            </form>
            
            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p className="mb-2">Demo Credentials:</p>
              <p className="font-mono bg-muted p-2 rounded">
                founder@apventures.com / admin
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;