import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ChevronRight, SkipForward } from "lucide-react";
import { useLocation } from "wouter";

export default function ProWelcomePage() {
  const [, setLocation] = useLocation();

  const handleSetupMacros = () => {
    setLocation("/macro-wizard");
  };

  const handleSkip = () => {
    setLocation("/plan");
  };

  return (
    <div className="min-h-screen bg-recipal-deep-green flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-4">
          <div className="w-20 h-20 bg-recipal-orange/20 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="w-10 h-10 text-recipal-orange" />
          </div>
          <h1 className="text-3xl font-bold text-white" data-testid="text-pro-welcome-title">
            You're now Pro!
          </h1>
          <p className="text-white/70 text-lg">
            Let's set up your macro targets so ReciPal can plan and track meals accurately for you.
          </p>
        </div>

        <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
          <CardContent className="p-6 space-y-4">
            <Button
              onClick={handleSetupMacros}
              className="w-full bg-recipal-orange hover:bg-recipal-orange/90 text-white h-12 text-lg"
              data-testid="button-setup-macros"
            >
              Set up my macros
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
            
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="w-full text-white/70 hover:text-white hover:bg-white/10"
              data-testid="button-skip-setup"
            >
              <SkipForward className="w-4 h-4 mr-2" />
              Skip for now
            </Button>
          </CardContent>
        </Card>

        <p className="text-white/50 text-sm">
          You can always set up your macros later from your Profile.
        </p>
      </div>
    </div>
  );
}
