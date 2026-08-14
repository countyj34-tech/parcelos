import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Keep SaaS console failures off the root error page. */
export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AdminErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold tracking-tight">Platform console failed to load</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.error.message || "Something went wrong rendering the admin dashboard."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button onClick={() => this.setState({ error: null })}>Try again</Button>
              <Button asChild variant="outline">
                <Link to="/">Go home</Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
