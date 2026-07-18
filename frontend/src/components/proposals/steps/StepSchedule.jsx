import { Copy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Button } from '@/components/ui/button.jsx';
import { DAYS, SEASONS } from '../utils/quoteMath.js';
import { cn } from '@/lib/utils.js';

export default function StepSchedule({ schedules, setSchedules }) {
  function getRow(season, day) {
    return schedules.find((s) => s.season_type === season && s.day_label === day) || {};
  }

  function setRow(season, day, patch) {
    setSchedules((arr) => {
      const idx = arr.findIndex((s) => s.season_type === season && s.day_label === day);
      if (idx === -1) return [...arr, { season_type: season, day_label: day, ...patch }];
      return arr.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    });
  }

  function copyDayToAll(season, day) {
    const src = getRow(season, day);
    setSchedules((arr) =>
      arr.map((s) =>
        s.season_type === season && s.day_label !== 'tatil'
          ? { ...s, open_time: src.open_time, close_time: src.close_time, is_closed: src.is_closed }
          : s
      )
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Season & operating schedule</CardTitle>
        <CardDescription>
          Define daily open / close hours for Normal Season and School / Off Season.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="normal">
          <TabsList className="w-full justify-start sm:w-auto">
            {SEASONS.map(([key, label]) => (
              <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
            ))}
          </TabsList>

          {SEASONS.map(([season]) => (
            <TabsContent key={season} value={season} className="mt-4">
              <div className="grid gap-2">
                {DAYS.map(([day, label]) => {
                  const r = getRow(season, day);
                  return (
                    <div
                      key={day}
                      className={cn(
                        'grid items-center gap-3 rounded-xl border border-border/80 bg-card px-3 py-3 transition-all duration-200',
                        'sm:grid-cols-[140px_1fr_1fr_auto_auto]',
                        r.is_closed && 'bg-muted/50'
                      )}
                    >
                      <div className="text-sm font-semibold text-foreground">{label}</div>
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Open
                        </div>
                        <Input
                          type="time"
                          value={r.open_time || ''}
                          disabled={!!r.is_closed}
                          onChange={(e) => setRow(season, day, { open_time: e.target.value })}
                          className="h-10"
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Close
                        </div>
                        <Input
                          type="time"
                          value={r.close_time || ''}
                          disabled={!!r.is_closed}
                          onChange={(e) => setRow(season, day, { close_time: e.target.value })}
                          className="h-10"
                        />
                      </div>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={!!r.is_closed}
                          onChange={(e) => setRow(season, day, { is_closed: e.target.checked })}
                          className="h-4 w-4 rounded border-border accent-accent"
                        />
                        Closed
                      </label>
                      {day !== 'tatil' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-muted-foreground"
                          onClick={() => copyDayToAll(season, day)}
                          title="Apply these hours to all days"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="hidden md:inline">All</span>
                        </Button>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
