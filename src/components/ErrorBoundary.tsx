import { Component, type ReactNode } from "react";
import { replaceConfig, START } from "../store/config";
import { clone } from "../lib/path";

/** A render error must not leave a black page: show it, and let the user drop a stored config that keeps crashing the app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ padding: 24, maxWidth: 560, margin: "10vh auto", font: "14px/1.5 system-ui, sans-serif", color: "#e6edf3" }}>
        <h2>Something went wrong</h2>
        <p>{error.message}</p>
        <button onClick={() => (this.setState({ error: null }))}>Try again</button>{" "}
        <button onClick={() => (replaceConfig(clone(START)), this.setState({ error: null }))}>Reset configuration</button>
      </div>
    );
  }
}
