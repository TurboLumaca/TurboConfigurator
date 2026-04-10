import React from "react";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error) {
    // Keep this log for local desktop debugging.
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary] runtime crash", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, fontFamily: "Inter, sans-serif" }}>
          <h2>Runtime error</h2>
          <p>L'app ha intercettato un errore invece di mostrare schermata bianca.</p>
          <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.message || "Unknown error"}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
