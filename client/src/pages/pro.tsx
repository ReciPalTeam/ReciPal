
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Zap, Check, LayoutDashboard, Target, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import Dashboard from "./dashboard";
import ProfilePage from "./profile";

export default function ProPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "tracker" | "targets" | "summary">("overview");

  if (activeTab === "tracker") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setActiveTab("overview")} className="mb-4">
          &larr; Back to Pro Overview
        </Button>
        <Dashboard />
      </div>
    );
  }

  if (activeTab === "targets") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setActiveTab("overview")} className="mb-4">
          &larr; Back to Pro Overview
        </Button>
        <ProfilePage />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Pro Sidebar */}
      <aside className="w-full md:w-64 space-y-2">
        <div className="p-4 bg-recipal-deep-green text-white rounded-xl mb-6">
          <h2 className="font-bold flex items-center gap-2">
            <Zap className="w-4 h-4 fill-current text-recipal-orange" />
            Pro Features
          </h2>
        </div>
        <Button 
          variant={activeTab === "overview" ? "secondary" : "ghost"} 
          className="w-full justify-start gap-2"
          onClick={() => setActiveTab("overview")}
        >
          <LayoutDashboard className="w-4 h-4" /> Overview
        </Button>
        <Button 
          variant={activeTab === "tracker" ? "secondary" : "ghost"} 
          className="w-full justify-start gap-2"
          onClick={() => setActiveTab("tracker")}
        >
          <PieChart className="w-4 h-4" /> Macro Tracker
        </Button>
        <Button 
          variant={activeTab === "targets" ? "secondary" : "ghost"} 
          className="w-full justify-start gap-2"
          onClick={() => setActiveTab("targets")}
        >
          <Target className="w-4 h-4" /> Macro Targets
        </Button>
      </aside>

      <main className="flex-1 space-y-8">
        <div className="text-left">
          <h1 className="text-3xl font-display font-bold text-recipal-deep-green">ReciPal Pro</h1>
          <p className="text-muted-foreground mt-2">Your complete nutrition and planning powerhouse.</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className="border-2 border-primary shadow-lg relative overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-recipal-orange fill-current" />
                Active Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">Pro Member &bull; $4.99/mo</p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  "Full Macronutrient Tracker",
                  "Micronutrient Breakdowns",
                  "Automated Macro-Balanced Planning",
                  "Weekly Nutrition Trends",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" /> {f}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
