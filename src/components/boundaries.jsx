import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Settings } from "lucide-react";
import { H } from "@/lib/bridge";
class PageBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("Study page failed", error);
  }
  render() {
    return this.state.failed ? (
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>This page couldn’t load</CardTitle>
          <CardDescription>
            Your saved data is still available. Retry this page or export a
            backup from Settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            onClick={() => {
              this.setState({ failed: false });
              H.App.refresh();
            }}
          >
            Retry page
          </Button>
          <Button variant="outline" asChild>
            <a href="#/settings">Settings & backup</a>
          </Button>
        </CardContent>
      </Card>
    ) : (
      this.props.children
    );
  }
}
function RecoveryNotice() {
  return H.Store.recoveryRequired ? (
    <div role="alert" className="mb-6 rounded-lg border p-4">
      <h2>Saved data needs recovery</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The saved workspace couldn’t be read. Your original data has been
        preserved. Saving is paused; download it first, then restore a valid
        backup in Settings or explicitly reset the workspace there.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => H.downloadRecovery()}>
          Download original data
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href="#/settings">Open Settings</a>
        </Button>
      </div>
    </div>
  ) : H.Store.saveError ? (
    <div role="alert" className="mb-6 rounded-lg border p-4 text-sm">
      Changes aren’t saved to browser storage. Export a backup in Settings
      before closing this tab.{" "}
      <Button size="sm" variant="outline" onClick={() => H.Store.save()}>
        Retry saving
      </Button>
    </div>
  ) : null;
}

class SearchLoadBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("Search could not load", error);
  }
  render() {
    return this.state.failed ? (
      <div
        role="alert"
        className="fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border bg-background p-4 shadow-lg"
      >
        <p className="text-sm">Search couldn’t load. Reload to try again.</p>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              if (H.Store.save()) location.reload();
              else {
                this.props.onClose();
                location.hash = "#/settings";
              }
            }}
          >
            Reload
          </Button>
          <Button size="sm" variant="outline" onClick={this.props.onClose}>
            Close
          </Button>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}

export { PageBoundary, RecoveryNotice, SearchLoadBoundary };
