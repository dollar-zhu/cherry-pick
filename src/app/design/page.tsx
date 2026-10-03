import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/brand/empty-state";
import { Glow } from "@/components/brand/glow";
import { Logo } from "@/components/brand/logo";
import { Orb } from "@/components/brand/orb";
import { ORB_STATES } from "@/components/brand/orb-state";
import { PageHeader } from "@/components/brand/page-header";

const SWATCHES = [
  ["Background", "bg-background"],
  ["Foreground", "bg-foreground"],
  ["Glass fill", "bg-card"],
  ["Primary", "bg-primary"],
  ["Brand gradient", "bg-brand-gradient"],
  ["Brand gradient (text)", "bg-brand-gradient-text"],
  ["Cherry", "bg-brand-cherry"],
  ["Orange", "bg-brand-orange"],
  ["Amber", "bg-brand-amber"],
  ["Destructive", "bg-destructive"],
  ["Success", "bg-success"],
  ["Warning", "bg-warning"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <h2 className="font-mono text-xs tracking-[0.12em] text-brand-orange uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <>
      <Glow intensity="app" />
      <main className="above-glow mx-auto grid w-full max-w-5xl gap-12 px-6 py-10">
        <PageHeader
          title="Design system"
          description="Every token and component in one place. Dev only."
          actions={<Logo height={22} />}
        />

        <Section title="Logo">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="glass grid h-32 place-items-center rounded-lg"><Logo height={28} /></div>
            <div className="grid h-32 place-items-center rounded-lg bg-primary"><Logo tone="color" height={28} /></div>
            <div className="glass flex h-32 items-end justify-center gap-4 rounded-lg pb-8">
              <Logo variant="mark" height={16} />
              <Logo variant="mark" height={32} />
              <Logo variant="mark" height={64} />
            </div>
          </div>
        </Section>

        <Section title="Color">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SWATCHES.map(([name, cls]) => (
              <div key={name} className="grid gap-2">
                <div className={`h-14 rounded-field border border-border ${cls}`} />
                <span className="text-xs text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Glass">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="glass rounded-lg p-4 text-sm">glass · panels, cards, top bar</div>
            <div className="glass-inset rounded-field p-4 text-sm">glass-inset · inputs, composer</div>
            <div className="glass-raised rounded-lg p-4 text-sm">glass-raised · menus, dialogs</div>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Save changes</Button>
            <Button variant="brand">✦ Find co-hosts</Button>
            <Button variant="outline">Preview</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Remove co-host</Button>
            <Button variant="link">View on Luma</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Form and alerts">
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Company profile</CardTitle>
                <CardDescription>Example values.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="design-city">City</Label>
                  <Input id="design-city" defaultValue="San Francisco" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="design-cap">Venue capacity</Label>
                  <Input id="design-cap" defaultValue="-20" aria-invalid="true" />
                  <p className="text-xs text-destructive">Capacity must be above 0.</p>
                </div>
              </CardContent>
            </Card>
            <div className="grid content-start gap-3">
              <Alert variant="success"><AlertTitle>Invites sent</AlertTitle><AlertDescription>3 companies were invited.</AlertDescription></Alert>
              <Alert variant="warning"><AlertTitle>2 credits left</AlertTitle><AlertDescription>Searches stop at 0.</AlertDescription></Alert>
              <Alert variant="destructive"><AlertTitle>Payment failed</AlertTitle><AlertDescription>Card declined. Try another card.</AlertDescription></Alert>
              <Alert><AlertTitle>Draft saved</AlertTitle><AlertDescription>Nothing was sent.</AlertDescription></Alert>
            </div>
          </div>
        </Section>

        <Section title="Voice orb">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ORB_STATES.map((s) => (
              <div key={s} className="glass grid justify-items-center gap-3 rounded-lg py-6">
                <Orb state={s} />
                <code className="font-mono text-xs text-muted-foreground">{s}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Empty state">
          <EmptyState
            title="No events yet"
            description="Describe your event and we'll find companies to co-host it."
            action={<Button variant="brand">+ New event</Button>}
          />
        </Section>
      </main>
    </>
  );
}
