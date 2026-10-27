import type { Metadata } from "next";
import { headers } from "next/headers";

import { SectionTitle } from "@/components/app/display";
import { PageHeader } from "@/components/app/page-header";
import { EditUserDialog, NewUserDialog, PipelineSettingsForm, ProductDialog } from "@/components/app/settings-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createUserAction, saveProductAction, saveSettingsAction, updateUserAction } from "@/lib/actions/settings";
import { getSettings, listProducts, listUsers } from "@/lib/dal/reference";
import { requirePageCapability } from "@/lib/dal/session";
import { OPEN_STAGES, ROLE_LABELS, STAGE_LABELS } from "@/lib/domain/constants";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePageCapability("settings:manage");
  const [products, users, settings, h] = await Promise.all([listProducts(), listUsers(), getSettings(), headers()]);
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  return (
    <>
      <PageHeader eyebrow="Records" title="Settings" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="pb-0">
          <CardContent>
            <SectionTitle action={<NewUserDialog action={createUserAction} />}>Users · {users.length}</SectionTitle>
          </CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="pl-5">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-muted-foreground text-xs">{u.email}</div>
                  </TableCell>
                  <TableCell>{ROLE_LABELS[u.role] ?? u.role}</TableCell>
                  <TableCell>{u.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                  <TableCell className="pr-5 text-right">
                    <EditUserDialog action={updateUserAction.bind(null, u.id)} values={{ name: u.name, role: u.role, active: u.active }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="grid content-start gap-5">
          <Card>
            <CardContent>
              <SectionTitle>Pipeline</SectionTitle>
              <PipelineSettingsForm
                action={saveSettingsAction}
                probabilities={OPEN_STAGES.map((s) => ({ stage: s, label: STAGE_LABELS[s], pct: Math.round(settings.stageProbability[s] * 100) }))}
                users={users.filter((u) => u.active).map((u) => ({ value: u.id, label: u.name }))}
                triageOwnerId={settings.triageOwnerId}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-2 text-sm">
              <SectionTitle>Website enquiry form</SectionTitle>
              <p>
                Point the enquiry form on dkliftservices.co.uk at <code className="bg-muted rounded px-1">POST {origin}/api/enquiries</code> and add the site to{" "}
                <code className="bg-muted rounded px-1">ENQUIRY_ALLOWED_ORIGINS</code>.
              </p>
              <p className="text-muted-foreground">
                Fields: name, organisation, email, phone, postcode, product, message, gclid, utm_source, utm_medium, utm_campaign, and an empty hidden <code>website</code> field as a honeypot.
                Enquiries with a gclid are recorded as Google Ads.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="pb-0 xl:col-span-2">
          <CardContent>
            <SectionTitle action={<ProductDialog action={saveProductAction.bind(null, null)} />}>Products · {products.length}</SectionTitle>
          </CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Manufacturer</TableHead>
                <TableHead className="text-right">Lead time</TableHead>
                <TableHead className="text-right">Install</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-5 font-medium">{p.name}</TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell>{p.manufacturer ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.leadTimeWeeks} wks</TableCell>
                  <TableCell className="text-right tabular-nums">{p.installDays} days</TableCell>
                  <TableCell>{p.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Hidden</Badge>}</TableCell>
                  <TableCell className="pr-5 text-right">
                    <ProductDialog action={saveProductAction.bind(null, p.id)} values={p} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
