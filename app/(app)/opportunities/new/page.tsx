import type { Metadata } from "next";

import { NewOpportunityForm } from "@/components/app/new-opportunity-form";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { clientOptions } from "@/lib/dal/clients";
import { listActiveUsers, listProducts } from "@/lib/dal/reference";
import { requirePageCapability } from "@/lib/dal/session";
import { addDays, formatDayInput, today } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "New opportunity" };

export default async function NewOpportunityPage({ searchParams }: PageProps<"/opportunities/new">) {
  const user = await requirePageCapability("opportunity:write");
  const sp = await searchParams;
  const [clients, products, users] = await Promise.all([clientOptions(), listProducts(), listActiveUsers()]);
  const preselect = typeof sp.client === "string" && clients.some((c) => c._id === sp.client) ? sp.client : undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Sales / Enquiries" title="New opportunity" description="One form for every source. Required fields are marked *." />
      <Card>
        <CardContent>
          <NewOpportunityForm
            clients={clients}
            products={products.filter((p) => p.active)}
            users={users.filter((u) => u.role !== "engineer")}
            currentUserId={user.id}
            defaultDue={formatDayInput(addDays(today(), 1))}
            preselectClientId={preselect}
          />
        </CardContent>
      </Card>
    </div>
  );
}
