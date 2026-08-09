import { motion } from 'framer-motion';
import { MapPin, UserRound, CalendarRange } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import CustomerCombobox from '../CustomerCombobox.jsx';
import { HideToggle } from '../VisibilityContext.jsx';

export default function StepCustomer({ q, setQ, customers, selectedCustomer }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Customer &amp; Facility</CardTitle>
            <CardDescription>Select an account and map facility details onto the contract.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <HideToggle k="spec.property" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Customer</Label>
            <CustomerCombobox
              customers={customers}
              value={q.customer_id}
              onChange={(c) => {
                setQ((prev) => ({
                  ...prev,
                  customer_id: c.id,
                  facility_name: prev.facility_name || c.name || '',
                  facility_address: prev.facility_address || c.address || '',
                }));
              }}
            />
          </div>

          {selectedCustomer && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-border/80 bg-muted/40 p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex gap-2 text-sm">
                  <UserRound className="mt-0.5 h-4 w-4 text-accent" />
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</div>
                    <div className="font-medium text-foreground">
                      {selectedCustomer.contact_person || 'Not specified'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[selectedCustomer.phone, selectedCustomer.email].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 text-accent" />
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</div>
                    <div className="font-medium text-foreground">
                      {selectedCustomer.address || 'No address on file'}
                    </div>
                    <div className="text-xs text-muted-foreground">{selectedCustomer.city || ''}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Facility name</Label>
              <Input
                value={q.facility_name}
                onChange={(e) => setQ({ ...q, facility_name: e.target.value })}
                placeholder="e.g. Ellicott Meadows"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Facility address</Label>
              <Input
                value={q.facility_address}
                onChange={(e) => setQ({ ...q, facility_address: e.target.value })}
                placeholder="Street, city, ZIP"
              />
            </div>
          </div>

          {/* PDF Section 1 prints these as two columns. They name the same party
              on most properties, so either column can be dropped on its own. */}
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="text-xs font-semibold text-foreground">
              PDF Section 1 — Property information columns
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Facility and Owner / Agent are usually the same company. Hide one and the other fills the width.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <HideToggle k="spec.propertyFacility" label="Facility name &amp; address" />
              <HideToggle k="spec.propertyOwner" label="Owner / Agent" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-accent" />
            <CardTitle>Contract duration</CardTitle>
          </div>
          <CardDescription>Start and end dates appear in PDF Section II.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input
                type="date"
                value={q.season_start || ''}
                onChange={(e) => setQ({ ...q, season_start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Input
                type="date"
                value={q.season_end || ''}
                onChange={(e) => setQ({ ...q, season_end: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Proposal valid until</Label>
              <Input
                type="date"
                value={q.valid_until || ''}
                onChange={(e) => setQ({ ...q, valid_until: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>School / off-season calendar note (PDF Section II)</Label>
            <textarea
              rows={2}
              value={q.notes || ''}
              onChange={(e) => setQ({ ...q, notes: e.target.value })}
              placeholder="e.g. County public schools are scheduled to close on 6/12/26 and reopen on 8/31/26. If these dates change, additional charges may apply."
              className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
