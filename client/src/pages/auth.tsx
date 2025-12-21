import { useState } from "react";
import { useLogin, useRegister, useUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading: isUserLoading } = useUser();
  const { mutate: login, isPending: isLoginPending } = useLogin();
  const { mutate: register, isPending: isRegisterPending } = useRegister();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (isUserLoading) return null;
  if (user) {
    setLocation("/dashboard");
    return null;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login({ username, password }, {
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    register({ username, password }, {
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/10 p-4">
      <div className="w-full max-w-md space-y-8 animate-in">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-green-600 shadow-xl shadow-primary/20 mb-4">
            <span className="text-3xl font-display font-bold text-white">M</span>
          </div>
          <h1 className="text-4xl font-display font-bold text-foreground">MacroCart</h1>
          <p className="text-muted-foreground text-lg">Smart meal planning for your goals & budget.</p>
        </div>

        <Card className="border-border/50 shadow-xl shadow-black/5 backdrop-blur-sm bg-white/80">
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Sign in to manage your meal plans</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Email</Label>
                    <Input 
                      id="username" 
                      type="email" 
                      placeholder="you@example.com"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input 
                      id="password" 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-white"
                    />
                  </div>
                  <Button type="submit" className="w-full font-semibold h-11" disabled={isLoginPending}>
                    {isLoginPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-username">Email</Label>
                    <Input 
                      id="reg-username" 
                      type="email" 
                      placeholder="you@example.com"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input 
                      id="reg-password" 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-white"
                    />
                  </div>
                  <Button type="submit" className="w-full font-semibold h-11" disabled={isRegisterPending}>
                    {isRegisterPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
