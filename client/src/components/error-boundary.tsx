import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-2" />
              <CardTitle>Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground text-sm">
                We encountered an unexpected error. Please try again.
              </p>
              <Button onClick={this.handleRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ 
  title = "Something went wrong", 
  message = "We couldn't load this content. Please try again.",
  onRetry,
  retryLabel = "Try Again"
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <div className="space-y-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export function ApiErrorState({ 
  apiName = "data",
  onRetry 
}: { 
  apiName?: string; 
  onRetry?: () => void 
}) {
  return (
    <ErrorState
      title={`Failed to load ${apiName}`}
      message={`We couldn't connect to our servers. Check your connection and try again.`}
      onRetry={onRetry}
    />
  );
}

export function InstacartErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="Instacart connection failed"
      message="We couldn't connect to Instacart. Your cart is saved and you can try again."
      onRetry={onRetry}
      retryLabel="Retry Connection"
    />
  );
}

export function ReceiptParseErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="Couldn't read receipt"
      message="We had trouble reading your receipt. Try taking a clearer photo or add items manually."
      onRetry={onRetry}
      retryLabel="Try Another Photo"
    />
  );
}

export function SubscriptionErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="Connection issue"
      message="We couldn't verify your subscription status. This might be a temporary issue."
      onRetry={onRetry}
      retryLabel="Check Again"
    />
  );
}
