import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Target, Calculator, Zap } from "lucide-react";
import { useLocation } from "wouter";

export default function MacroWizardPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <header className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/profile")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Macro Wizard</h1>
      </header>

      <div className="space-y-6">
        <Card className="bg-recipal-orange/5 border-recipal-orange/20">
          <CardContent className="pt-6 space-y-4 text-center">
            <div className="w-16 h-16 mx-auto bg-recipal-orange/10 rounded-full flex items-center justify-center">
              <Calculator className="w-8 h-8 text-recipal-orange" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold">Coming Soon</h2>
              <p className="text-sm text-muted-foreground">
                The macro wizard will help you calculate your personalized daily macro targets using the Mifflin-St Jeor formula.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 space-y-2">
            <Target className="w-5 h-5 text-primary" />
            <p className="text-sm font-medium">Fast Track</p>
            <p className="text-xs text-muted-foreground">Enter your targets manually</p>
          </Card>
          <Card className="p-4 space-y-2">
            <Zap className="w-5 h-5 text-recipal-orange" />
            <p className="text-sm font-medium">Guided Setup</p>
            <p className="text-xs text-muted-foreground">Calculate based on your stats</p>
          </Card>
        </div>

        <Button 
          className="w-full bg-recipal-orange hover:bg-recipal-orange/90"
          onClick={() => setLocation("/profile")}
          data-testid="button-return-profile"
        >
          Return to Profile
        </Button>
      </div>
    </div>
  );
}
