import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, Key, Bell, Clock, Tag, ExternalLink, Info } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<{
    finnhubApiKey: string;
    finnhubApiKeyMasked: string;
    alertSound: boolean;
    alertHighOnly: boolean;
    keywords: string[];
    pollingIntervalSeconds: number;
  }>({
    queryKey: ["/api/settings"],
  });

  const [apiKey, setApiKey] = useState("");
  const [alertSound, setAlertSound] = useState(true);
  const [alertHighOnly, setAlertHighOnly] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [pollingInterval, setPollingInterval] = useState(15);
  const [apiKeyChanged, setApiKeyChanged] = useState(false);

  useEffect(() => {
    if (settings) {
      setAlertSound(settings.alertSound);
      setAlertHighOnly(settings.alertHighOnly);
      setKeywords(settings.keywords ?? []);
      setPollingInterval(settings.pollingIntervalSeconds ?? 15);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/settings", {
      ...(apiKeyChanged && apiKey ? { finnhubApiKey: apiKey } : {}),
      alertSound,
      alertHighOnly,
      keywords,
      pollingIntervalSeconds: pollingInterval,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setApiKeyChanged(false);
      setApiKey("");
      toast({ title: "Settings saved", description: "Changes applied successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    },
  });

  const addKeyword = () => {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords(prev => [...prev, kw]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords(prev => prev.filter(k => k !== kw));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Configure your MNQ Pulse alert system</p>
      </div>

      {/* API Key */}
      <Card className="border-border">
        <CardHeader className="py-4 px-5 pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            Finnhub API Key
          </CardTitle>
          <CardDescription className="text-xs">
            Required for live news polling. Free tier includes market news and earnings calendar.{" "}
            <a
              href="https://finnhub.io/register"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline inline-flex items-center gap-0.5"
            >
              Get free key <ExternalLink className="w-3 h-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          {settings?.finnhubApiKeyMasked && !apiKeyChanged && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/30 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              API key configured: <span className="font-mono">{settings.finnhubApiKeyMasked}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="api-key" className="text-xs text-muted-foreground">
              {settings?.finnhubApiKeyMasked ? "Replace API key" : "Enter API key"}
            </Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Enter your Finnhub API key..."
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setApiKeyChanged(true); }}
              className="font-mono text-xs h-8"
              data-testid="input-api-key"
            />
          </div>

          <div className="rounded-md bg-muted/50 border border-border p-3 text-xs space-y-1 text-muted-foreground">
            <p className="font-medium text-foreground flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />Free tier includes:</p>
            <ul className="space-y-0.5 ml-5 list-disc">
              <li>General market news (unlimited)</li>
              <li>Forex news (unlimited)</li>
              <li>Company news for NVDA, MSFT, AAPL (today)</li>
              <li>Economic calendar with forecasts</li>
              <li>30 API calls/second rate limit</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Alert Behavior */}
      <Card className="border-border">
        <CardHeader className="py-4 px-5 pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            Alert Behavior
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Alert Sound</p>
              <p className="text-xs text-muted-foreground">Play a beep when new high-impact news arrives</p>
            </div>
            <Switch
              checked={alertSound}
              onCheckedChange={setAlertSound}
              data-testid="switch-alert-sound"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">High Impact Only</p>
              <p className="text-xs text-muted-foreground">Only alert on HIGH and CRITICAL articles</p>
            </div>
            <Switch
              checked={alertHighOnly}
              onCheckedChange={setAlertHighOnly}
              data-testid="switch-high-only"
            />
          </div>
        </CardContent>
      </Card>

      {/* Polling Interval */}
      <Card className="border-border">
        <CardHeader className="py-4 px-5 pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Polling Interval
          </CardTitle>
          <CardDescription className="text-xs">
            How often to fetch news during active trading hours (pre-market + RTH)
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex flex-wrap gap-2">
            {[10, 15, 30, 60].map(s => (
              <button
                key={s}
                className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
                  pollingInterval === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                }`}
                onClick={() => setPollingInterval(s)}
                data-testid={`polling-${s}`}
              >
                {s}s
              </button>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <Label htmlFor="custom-interval" className="text-xs text-muted-foreground">Custom:</Label>
              <Input
                id="custom-interval"
                type="number"
                min={5}
                max={300}
                value={pollingInterval}
                onChange={e => setPollingInterval(parseInt(e.target.value) || 15)}
                className="w-16 h-7 text-xs font-mono"
                data-testid="input-polling-interval"
              />
              <span className="text-xs text-muted-foreground">seconds</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Polling only runs during pre-market (8:00 CT / 6:00 PT) and RTH (8:30–15:00 CT / 6:30–13:00 PT).
          </p>
        </CardContent>
      </Card>

      {/* Keywords */}
      <Card className="border-border">
        <CardHeader className="py-4 px-5 pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            Impact Keywords
          </CardTitle>
          <CardDescription className="text-xs">
            Articles containing these keywords are classified as HIGH impact
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Add keyword (e.g. 'taiwan', 'opec')..."
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
              className="text-xs h-8 font-mono"
              data-testid="input-keyword"
            />
            <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={addKeyword} data-testid="button-add-keyword">
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map(kw => (
              <Badge
                key={kw}
                variant="secondary"
                className="text-xs font-mono cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={() => removeKeyword(kw)}
                data-testid={`keyword-${kw}`}
                title="Click to remove"
              >
                {kw} ×
              </Badge>
            ))}
            {keywords.length === 0 && (
              <p className="text-xs text-muted-foreground">No keywords. Default impact classification will apply.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button
        className="w-full gap-2"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        data-testid="button-save"
      >
        <Save className="w-4 h-4" />
        {saveMutation.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
