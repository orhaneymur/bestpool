import { motion } from 'framer-motion';
import { MapPin, UserRound, CalendarRange } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import CustomerCombobox from '../CustomerCombobox.jsx';

export default function StepCustomer({ q, setQ, customers, selectedCustomer }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Customer & Facility</CardTitle>
          <CardDescription>Select an account and map facility details onto the contract.</CardDescription>
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
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
