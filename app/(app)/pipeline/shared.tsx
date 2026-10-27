import Link from "next/link";
import { Plus } from "lucide-react";

import { UrlFilters } from "@/components/app/filters";
import { LinkTabs, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import type { OpportunityFilters } from "@/lib/dal/opportunities";
import { listActiveUsers } from "@/lib/dal/reference";
import { SEGMENTS, SEGMENT_LABELS, SOURCES, SOURCE_LABELS, STAGES, type Segment, type Source, type Stage } from "@/lib/domain/constants";

export function parseFilters(sp: Record<string, string | string[] | undefined>): OpportunityFilters & { page?: number } {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const source = one("source");
  const segment = one("segment");
  const stage = one("stage");
  return {
    q: one("q"),
    ownerId: one("owner") && /^[a-f0-9]{24}$/.test(one("owner")!) ? one("owner") : undefined,
    source: SOURCES.includes(source as Source) ? (source as Source) : undefined,
    segment: SEGMENTS.includes(segment as Segment) ? (segment as Segment) : undefined,
    stage: STAGES.includes(stage as Stage) ? (stage as Stage) : undefined,
    page: Number(one("page")) || 1,
  };
}

export async function PipelineHeader({ active, title, withFilters = true }: { active: string; title: string; withFilters?: boolean }) {
  const users = await listActiveUsers();
  return (
    <PageHeader
      eyebrow="Sales / Pipeline"
      title={title}
      actions={
        <Button asChild variant="brand">
          <Link href="/opportunities/new">
            <Plus /> New enquiry
          </Link>
        </Button>
      }
    >
      <LinkTabs
        active={active}
        tabs={[
          { key: "board", label: "Board", href: "/pipeline" },
          { key: "list", label: "List", href: "/pipeline/list" },
          { key: "monday", label: "Monday review", href: "/pipeline/monday" },
          { key: "closed", label: "Won / lost", href: "/pipeline/closed" },
        ]}
      />
      {withFilters && (
        <UrlFilters
          placeholder="Search client, site, product or ref"
          selects={[
            { name: "owner", label: "Owner", options: users.map((u) => ({ value: u.id, label: u.name })) },
            { name: "source", label: "Source", options: SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] })) },
            { name: "segment", label: "Segment", options: SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABELS[s] })) },
          ]}
        />
      )}
    </PageHeader>
  );
}
