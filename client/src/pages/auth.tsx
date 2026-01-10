import { useState, useEffect } from "react";
import { useLogin, useRegister, useUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import logoUrl from "@assets/Untitled_design_(4)_1768078587312.png";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: isUserLoading } = useUser();
  const { mutate: login, isPending: isLoginPending } = useLogin();
  const { mutate: register, isPending: isRegisterPending } = useRegister();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (isUserLoading) return null;

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 overflow-hidden relative">
      <div className="w-full max-w-md space-y-8 animate-in relative z-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-full mb-2">
            <img 
              src={logoUrl} 
              alt="ReciPal Logo" 
              className="h-32 w-auto object-contain drop-shadow-2xl" 
            />
          </div>
          <div className="space-y-1">
            <p className="text-recipal-deep-green/80 font-medium text-lg">Eat smart. Save more. Cook better.</p>
          </div>
        </div>

        <Card className="border-0 shadow-2xl bg-white rounded-2xl overflow-hidden ring-1 ring-black/5">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl text-recipal-deep-green">Welcome to the family</CardTitle>
            <CardDescription className="text-muted-foreground/80">Sign in to access your smart kitchen</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8 bg-recipal-deep-green/5 p-1 rounded-xl">
                <TabsTrigger 
                  value="login" 
                  className="rounded-lg data-[state=active]:bg-recipal-deep-green data-[state=active]:text-white transition-all duration-200"
                >
                  Login
                </TabsTrigger>
                <TabsTrigger 
                  value="register" 
                  className="rounded-lg data-[state=active]:bg-recipal-deep-green data-[state=active]:text-white transition-all duration-200"
                >
                  Register
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-recipal-deep-green font-semibold ml-1">Email Address</Label>
                    <Input 
                      id="username" 
                      type="email" 
                      placeholder="chef@recipal.com"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="h-12 bg-white border-recipal-deep-green/10 focus:border-recipal-orange focus:ring-recipal-orange/20 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-recipal-deep-green font-semibold ml-1">Password</Label>
                    <Input 
                      id="password" 
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-12 bg-white border-recipal-deep-green/10 focus:border-recipal-orange focus:ring-recipal-orange/20 rounded-xl"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-recipal-orange hover:bg-recipal-orange/90 text-white font-bold h-12 rounded-xl shadow-lg shadow-recipal-orange/20 transition-all active:scale-[0.98]" 
                    disabled={isLoginPending}
                  >
                    {isLoginPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Sign In to Kitchen"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="reg-username" className="text-recipal-deep-green font-semibold ml-1">Email Address</Label>
                    <Input 
                      id="reg-username" 
                      type="email" 
                      placeholder="chef@recipal.com"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="h-12 bg-white border-recipal-deep-green/10 focus:border-recipal-orange focus:ring-recipal-orange/20 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password" className="text-recipal-deep-green font-semibold ml-1">Create Password</Label>
                    <Input 
                      id="reg-password" 
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-12 bg-white border-recipal-deep-green/10 focus:border-recipal-orange focus:ring-recipal-orange/20 rounded-xl"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-recipal-deep-green hover:bg-recipal-deep-green/90 text-white font-bold h-12 rounded-xl shadow-lg shadow-recipal-deep-green/20 transition-all active:scale-[0.98]" 
                    disabled={isRegisterPending}
                  >
                    {isRegisterPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Start Cooking Free"}
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground mt-4 px-4 leading-relaxed">
                    By joining, you agree to ReciPal's mission of reducing food waste and making healthy eating accessible to everyone.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <div className="flex justify-center gap-6 text-recipal-deep-green/40 text-xs font-medium uppercase tracking-widest">
          <span>Smart Planning</span>
          <span>•</span>
          <span>Zero Waste</span>
          <span>•</span>
          <span>Budget Friendly</span>
        </div>
      </div>
    </div>
  );
}
