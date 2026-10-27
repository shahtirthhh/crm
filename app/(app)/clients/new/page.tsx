import type { Metadata } from "next";

import { NewClientForm } from "@/components/app/client-forms";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createClientAction } from "@/lib/actions/clients";
import { listActiveUsers } from "@/lib/dal/reference";
import { requirePageCapability } from "@/lib/dal/session";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  await requirePageCapability("client:write");
  const users = await listActiveUsers();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Records / Clients" title="New client" description="Add contacts and sites on the client page after saving." />
      <Card>
        <CardContent>
          <NewClientForm action={createClientAction} users={users.map((u) => ({ value: u.id, label: u.name }))} />
        </CardContent>
      </Card>
    </div>
  );
}
